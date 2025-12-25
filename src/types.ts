export type QuestionType = 'mcq' | 'short' | 'essay' | 'code';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  // For MCQ
  options?: string[];
  correctOptionIndex?: number;
  // For short/essay rubrics
  rubric?: any;
}

export interface Assignment {
  id: string;
  title: string;
  questions: Question[];
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  answers: Record<string, any>; // questionId -> answer
}

export interface GradeDetail {
  questionId: string;
  correct: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
}

export interface GradeResult {
  submissionId: string;
  totalScore: number;
  details: GradeDetail[];
}

export interface Grader<TQuestion = any, TAnswer = any> {
  grade(question: TQuestion, answer: TAnswer): Promise<GradeDetail>;
}
