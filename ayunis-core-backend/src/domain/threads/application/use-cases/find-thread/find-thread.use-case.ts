import { Injectable, Logger } from '@nestjs/common';
import { Thread } from '../../../domain/thread.entity';
import { ThreadsRepository } from '../../ports/threads.repository';
import { FindThreadQuery } from './find-thread.query';
import { ThreadNotFoundError } from '../../threads.errors';
import { GetAvailableModelUseCase } from 'src/domain/models/application/use-cases/get-available-model/get-available-model.use-case';
import { GetAvailableModelQuery } from 'src/domain/models/application/use-cases/get-available-model/get-available-model.query';

@Injectable()
export class FindThreadUseCase {
  private readonly logger = new Logger(FindThreadUseCase.name);

  constructor(
    private readonly threadsRepository: ThreadsRepository,
    private readonly getAvailableModelUseCase: GetAvailableModelUseCase,
  ) {}

  async execute(query: FindThreadQuery): Promise<Thread> {
    this.logger.log('findOne', { threadId: query.id, userId: query.userId });
    try {
      const thread = await this.threadsRepository.findOne(
        query.id,
        query.userId,
      );
      if (!thread) {
        throw new ThreadNotFoundError(query.id, query.userId);
      }
      const modelWithConfig = this.getAvailableModelUseCase.execute(
        new GetAvailableModelQuery(
          thread.model.model.name,
          thread.model.model.provider,
        ),
      );
      return new Thread({
        ...thread,
        modelConfig: modelWithConfig.config,
      });
    } catch (error) {
      if (error instanceof ThreadNotFoundError) {
        throw error;
      }
      this.logger.error('Failed to find thread', {
        threadId: query.id,
        userId: query.userId,
        error,
      });
      throw error;
    }
  }
}
