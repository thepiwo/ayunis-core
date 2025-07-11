import { Module } from '@nestjs/common';
import { ModelsController } from './presenters/http/models.controller';
import { MistralInferenceHandler } from './infrastructure/inference/mistral.inference';
import { InferenceHandlerRegistry } from './application/registry/inference-handler.registry';
import { ModelRegistry } from './application/registry/model.registry';
import {
  MISTRAL_INFERENCE_HANDLER,
  ANTHROPIC_INFERENCE_HANDLER,
  OPENAI_INFERENCE_HANDLER,
} from './application/tokens/inference-handler.tokens';
import { ModelProvider } from './domain/value-objects/model-provider.object';
import { OpenAIInferenceHandler } from './infrastructure/inference/openai.inference';
import { AnthropicInferenceHandler } from './infrastructure/inference/anthropic.inference';
import { GetInferenceUseCase } from './application/use-cases/get-inference/get-inference.use-case';
import { GetAvailableModelsUseCase } from './application/use-cases/get-available-models/get-available-models.use-case';
import { GetDefaultModelUseCase } from './application/use-cases/get-default-model/get-default-model.use-case';
import { GetPermittedModelUseCase } from './application/use-cases/get-permitted-model/get-permitted-model.use-case';
import { GetPermittedModelsUseCase } from './application/use-cases/get-permitted-models/get-permitted-models.use-case';
import { IsModelPermittedUseCase } from './application/use-cases/is-model-permitted/is-model-permitted.use-case';
import { ModelResponseDtoMapper } from './presenters/http/mappers/model-response-dto.mapper';
import { ModelWithConfigResponseDtoMapper } from './presenters/http/mappers/model-with-config-response-dto.mapper';
import { LocalPermittedModelsRepositoryModule } from './infrastructure/persistence/local-permitted-models/local-permitted-models-repository.module';
import { LocalUserDefaultModelsRepositoryModule } from './infrastructure/persistence/local-user-default-models/local-user-default-models-repository.module';
import { CreatePermittedModelUseCase } from './application/use-cases/create-permitted-model/create-permitted-model.use-case';
import { DeletePermittedModelUseCase } from './application/use-cases/delete-permitted-model/delete-permitted-model.use-case';
import { GetAvailableModelUseCase } from './application/use-cases/get-available-model/get-available-model.use-case';
import { StreamInferenceUseCase } from './application/use-cases/stream-inference/stream-inference.use-case';
import { StreamInferenceHandlerRegistry } from './application/registry/stream-inference-handler.registry';
import { AnthropicStreamInferenceHandler } from './infrastructure/stream-inference/anthropic.stream-inference';
import { OpenAIStreamInferenceHandler } from './infrastructure/stream-inference/openai.stream-inference';
import { ManageUserDefaultModelUseCase } from './application/use-cases/manage-user-default-model/manage-user-default-model.use-case';
import { DeleteUserDefaultModelUseCase } from './application/use-cases/delete-user-default-model/delete-user-default-model.use-case';
import { GetUserDefaultModelUseCase } from './application/use-cases/get-user-default-model/get-user-default-model.use-case';
import { GetOrgDefaultModelUseCase } from './application/use-cases/get-org-default-model/get-org-default-model.use-case';
import { ManageOrgDefaultModelUseCase } from './application/use-cases/manage-org-default-model/manage-org-default-model.use-case';

@Module({
  imports: [
    LocalPermittedModelsRepositoryModule,
    LocalUserDefaultModelsRepositoryModule,
  ],
  controllers: [ModelsController],
  providers: [
    ModelRegistry,
    ModelResponseDtoMapper,
    ModelWithConfigResponseDtoMapper,
    AnthropicStreamInferenceHandler,
    OpenAIStreamInferenceHandler,
    {
      provide: MISTRAL_INFERENCE_HANDLER,
      useClass: MistralInferenceHandler,
    },
    {
      provide: OPENAI_INFERENCE_HANDLER,
      useClass: OpenAIInferenceHandler,
    },
    {
      provide: ANTHROPIC_INFERENCE_HANDLER,
      useClass: AnthropicInferenceHandler,
    },
    {
      provide: StreamInferenceHandlerRegistry,
      useFactory: (anthropicHandler, openaiHandler) => {
        const registry = new StreamInferenceHandlerRegistry();
        registry.register(ModelProvider.OPENAI, openaiHandler);
        registry.register(ModelProvider.ANTHROPIC, anthropicHandler);
        return registry;
      },
      inject: [AnthropicStreamInferenceHandler, OpenAIStreamInferenceHandler],
    },
    {
      provide: InferenceHandlerRegistry,
      useFactory: (mistralHandler, openaiHandler, anthropicHandler) => {
        const registry = new InferenceHandlerRegistry();
        registry.register(ModelProvider.MISTRAL, mistralHandler);
        registry.register(ModelProvider.OPENAI, openaiHandler);
        registry.register(ModelProvider.ANTHROPIC, anthropicHandler);
        return registry;
      },
      inject: [
        MISTRAL_INFERENCE_HANDLER,
        OPENAI_INFERENCE_HANDLER,
        ANTHROPIC_INFERENCE_HANDLER,
      ],
    },
    // Use Cases
    CreatePermittedModelUseCase,
    DeletePermittedModelUseCase,
    GetAvailableModelUseCase,
    GetPermittedModelUseCase,
    GetPermittedModelsUseCase,
    IsModelPermittedUseCase,
    GetDefaultModelUseCase,
    GetInferenceUseCase,
    StreamInferenceUseCase,
    GetAvailableModelsUseCase,
    // User Default Model Use Cases
    ManageUserDefaultModelUseCase,
    DeleteUserDefaultModelUseCase,
    GetUserDefaultModelUseCase,
    GetOrgDefaultModelUseCase,
    // Org Default Model Use Cases
    ManageOrgDefaultModelUseCase,
  ],
  exports: [
    InferenceHandlerRegistry,
    ModelRegistry,
    CreatePermittedModelUseCase,
    DeletePermittedModelUseCase,
    GetAvailableModelUseCase,
    GetPermittedModelUseCase,
    GetPermittedModelsUseCase,
    IsModelPermittedUseCase,
    GetDefaultModelUseCase,
    // Use Cases
    GetInferenceUseCase,
    StreamInferenceUseCase,
    GetAvailableModelsUseCase,
    // User Default Model Use Cases
    ManageUserDefaultModelUseCase,
    DeleteUserDefaultModelUseCase,
    GetUserDefaultModelUseCase,
    GetOrgDefaultModelUseCase,
    // Org Default Model Use Cases
    ManageOrgDefaultModelUseCase,
  ],
})
export class ModelsModule {}
