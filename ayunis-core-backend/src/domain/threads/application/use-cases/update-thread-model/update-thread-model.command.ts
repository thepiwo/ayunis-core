import { UUID } from 'crypto';
import { ModelProvider } from 'src/domain/models/domain/value-objects/model-provider.object';

export class UpdateThreadModelCommand {
  constructor(
    public readonly threadId: UUID,
    public readonly userId: UUID,
    public readonly modelName: string,
    public readonly modelProvider: ModelProvider,
  ) {}
}
