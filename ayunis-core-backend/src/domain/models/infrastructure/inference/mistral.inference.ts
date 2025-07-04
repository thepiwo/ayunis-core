import { Logger } from '@nestjs/common';
import { TextMessageContent } from '../../../messages/domain/message-contents/text.message-content.entity';
import { ToolUseMessageContent } from '../../../messages/domain/message-contents/tool-use.message-content.entity';
import { Tool as ToolEntity } from '../../../tools/domain/tool.entity';
import { Message } from '../../../messages/domain/message.entity';
import { UserMessage } from '../../../messages/domain/messages/user-message.entity';
import { AssistantMessage } from '../../../messages/domain/messages/assistant-message.entity';
import { SystemMessage } from '../../../messages/domain/messages/system-message.entity';
import { ToolResultMessage } from '../../../messages/domain/messages/tool-result-message.entity';
import retryWithBackoff from 'src/common/util/retryWithBackoff';
import { Mistral } from '@mistralai/mistralai';
import {
  ToolCall,
  Tool,
  Messages,
  ToolChoiceEnum as MistralToolChoiceEnum,
  ToolChoice as MistralToolChoice,
} from '@mistralai/mistralai/models/components';
import { ChatCompletionResponse } from '@mistralai/mistralai/models/components';
import { Injectable } from '@nestjs/common';
import {
  InferenceHandler,
  InferenceResponse,
  InferenceInput as HandlerInferenceInput,
} from '../../application/ports/inference.handler';
import { ModelToolChoice } from '../../application/enums/model-tool-choice.enum';
import { ConfigService } from '@nestjs/config';
import { InferenceFailedError } from 'src/domain/models/application/models.errors';

@Injectable()
export class MistralInferenceHandler extends InferenceHandler {
  private readonly logger = new Logger(MistralInferenceHandler.name);
  private readonly client: Mistral;

  constructor(private readonly configService: ConfigService) {
    super();
    this.client = new Mistral({
      apiKey: this.configService.get('mistral.apiKey'),
    });
  }

  async answer(input: HandlerInferenceInput): Promise<InferenceResponse> {
    this.logger.log('answer', input);
    const { model, messages, tools, toolChoice } = input;
    const mistralTools = tools?.map(this.convertTool);
    const mistralMessages = this.convertMessages(messages);
    const mistralToolChoice = toolChoice
      ? this.convertToolChoice(toolChoice)
      : undefined;

    const completionFn = () =>
      this.client.chat.complete({
        model: model.name,
        messages: mistralMessages,
        tools: mistralTools,
        toolChoice: mistralToolChoice,
        maxTokens: 1000,
      });

    const response = await retryWithBackoff({
      fn: completionFn,
      maxRetries: 3,
      delay: 1000,
    });

    const modelResponse = this.parseCompletion(response);
    return modelResponse;
  }

  private convertTool(tool: ToolEntity): Tool {
    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as Record<string, any>,
      },
    };
  }

  private convertMessages(messages: Message[]): Messages[] {
    const convertedMessages: Messages[] = [];
    for (const message of messages) {
      convertedMessages.push(...this.convertMessage(message));
    }
    return convertedMessages;
  }

  private convertMessage(message: Message): Messages[] {
    const convertedMessages: Messages[] = [];
    // User Message
    if (message instanceof UserMessage) {
      for (const content of message.content) {
        // Text Message Content
        if (content instanceof TextMessageContent) {
          convertedMessages.push({
            role: 'user' as const,
            content: [
              {
                type: 'text' as const,
                text: content.text,
              },
            ],
          });
        }
      }
    }

    if (message instanceof AssistantMessage) {
      let assistantTextMessageContent: string | undefined = undefined;
      let assistantToolUseMessageContent: ToolCall[] | undefined = undefined;

      for (const content of message.content) {
        // Text Message Content
        if (content instanceof TextMessageContent) {
          assistantTextMessageContent = content.text;
        }
        // Tool Use Message Content
        if (content instanceof ToolUseMessageContent) {
          if (!assistantToolUseMessageContent) {
            assistantToolUseMessageContent = [
              {
                id: content.id,
                type: 'function',
                function: {
                  name: content.name,
                  arguments: content.params,
                },
              },
            ];
          } else {
            assistantToolUseMessageContent.push({
              id: content.id,
              type: 'function',
              function: {
                name: content.name,
                arguments: content.params,
              },
            });
          }
        }
      }
      convertedMessages.push({
        role: 'assistant' as const,
        content: assistantTextMessageContent,
        toolCalls: assistantToolUseMessageContent,
      });
    }

    if (message instanceof SystemMessage) {
      for (const content of message.content) {
        convertedMessages.push({
          role: 'system' as const,
          content: content.text,
        });
      }
    }

    if (message instanceof ToolResultMessage) {
      for (const content of message.content) {
        convertedMessages.push({
          role: 'tool' as const,
          toolCallId: content.toolId,
          content: content.result,
        });
      }
      if (
        message.content.every(
          (c) => c.result === 'Tool has been displayed successfully',
        )
      ) {
        convertedMessages.push({
          role: 'assistant' as const,
          content: 'Awaiting user input',
        });
      }
    }

    return convertedMessages;
  }

  private convertToolChoice(
    toolChoice: ModelToolChoice,
  ): MistralToolChoice | MistralToolChoiceEnum {
    if (toolChoice === 'auto') {
      return 'auto';
    } else if (toolChoice === 'required') {
      return 'required';
    } else {
      return { type: 'function', function: { name: toolChoice } };
    }
  }

  private parseCompletion(response: ChatCompletionResponse): InferenceResponse {
    const completion = response.choices && response.choices[0].message;
    const modelResponseContent: Array<
      TextMessageContent | ToolUseMessageContent
    > = [];

    if (!completion) {
      throw new InferenceFailedError('No completion returned from model', {
        source: 'mistral',
      });
    }

    if (completion.content) {
      // content is either string or array
      if (Array.isArray(completion.content)) {
        for (const content of completion.content) {
          if (content.type === 'text') {
            modelResponseContent.push(new TextMessageContent(content.text));
          }
        }
      } else if (completion.content) {
        // content is string
        modelResponseContent.push(new TextMessageContent(completion.content));
      }
    }

    for (const tool of completion.toolCalls || []) {
      const { id, name, params } = this.parseToolCall(tool);
      modelResponseContent.push(
        new ToolUseMessageContent(
          id || 'none',
          name,
          params as Record<string, any>,
        ),
      );
    }

    const modelResponse: InferenceResponse = {
      content: modelResponseContent,
      meta: {
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
      },
    };

    return modelResponse;
  }

  private parseToolCall(toolCall: ToolCall): {
    id: string | undefined;
    name: string;
    params: { [k: string]: any } | string;
  } {
    const id = toolCall.id;
    const name = toolCall.function.name;
    const parameters = toolCall.function.arguments;
    if (typeof parameters === 'string') {
      return { id, name, params: JSON.parse(parameters) };
    }
    return { id, name, params: parameters };
  }
}
