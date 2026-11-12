import { GraderRegistry } from './core.js';
import { MCQGrader } from '../graders/mcq.js';
import { ShortAnswerGrader } from '../graders/shortAnswer.js';
import { EssayGrader } from '../graders/essay.js';
import { CodeGrader } from '../graders/code.js';

export const registry = new GraderRegistry();
registry.register('mcq', new MCQGrader());
// Explicit opt-in; Core owns provider credentials and the embedding API.
const useEmbeddings = process.env.ASSESS_USE_AI_EMBEDDINGS === 'true';
registry.register('short', new ShortAnswerGrader(0.6, useEmbeddings));
registry.register('essay', new EssayGrader());
registry.register('code', new CodeGrader());
