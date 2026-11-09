export class AgentJobValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentJobValidationError';
  }
}
