import { UUID } from 'crypto';

export class FindAllThreadsQuery {
  constructor(public readonly userId: UUID) {}
}
