import { GraderRegistry } from './core';
import { MCQGrader } from '../graders/mcq';
import { ShortAnswerGrader } from '../graders/shortAnswer';
import { EssayGrader } from '../graders/essay';
import { CodeGrader } from '../graders/code';

export const registry = new GraderRegistry();
registry.register('mcq', new MCQGrader());
// Enable embeddings by default when OPENAI_API_KEY is provided
const useEmbeddings = Boolean(process.env.OPENAI_API_KEY);
registry.register('short', new ShortAnswerGrader(0.6, useEmbeddings));
registry.register('essay', new EssayGrader());
registry.register('code', new CodeGrader());
