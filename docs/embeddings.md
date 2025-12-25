# Embedding-based Short Answer Grading

Assess uses OpenAI embeddings (by default `text-embedding-3-small`) to compute semantic similarity between the model answer and a student's answer.

- Configure `OPENAI_API_KEY` to enable embeddings.
- Tune `SHORT_EMBEDDING_THRESHOLD` (default: `0.72`) to adjust pass/fail sensitivity.
- The system caches embeddings in-memory for repeated text to reduce cost.
- If embeddings calls fail, the grader falls back to the legacy token-overlap method.

Note: Embedding costs are per-token; consider limiting max text length for short-answer grading or batching embeddings when scoring many responses.
