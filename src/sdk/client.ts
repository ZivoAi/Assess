import axios from 'axios';

export async function sendSubmission(apiUrl: string, submission: any) {
  const res = await axios.post(`${apiUrl}/api/submissions`, submission);
  return res.data;
}
