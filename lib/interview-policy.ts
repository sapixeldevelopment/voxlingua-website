export type InterviewTranscriptLine = {
  role?: unknown;
  text?: unknown;
  at?: unknown;
};

export type InterviewTranscriptAssessment = {
  eligible: boolean;
  applicantTurns: number;
  substantiveTurns: number;
  wordCount: number;
  characterCount: number;
  requiredSubstantiveTurns: number;
  minimumWords: number;
  minimumCharacters: number;
  message: string;
};

const DEFAULT_QUESTION_COUNT = 3;
export const MAX_INTERVIEW_QUESTIONS = 8;
export const INTERVIEW_TIME_LIMIT_SECONDS = 20 * 60;
const FILLER_WORDS = new Set([
  "ah",
  "er",
  "erm",
  "hmm",
  "hm",
  "like",
  "mhm",
  "uh",
  "uhh",
  "um",
  "umm",
]);

export function normalizeInterviewQuestionCount(questionCount: number) {
  if (!Number.isFinite(questionCount) || questionCount < 1) return DEFAULT_QUESTION_COUNT;
  return Math.max(1, Math.min(MAX_INTERVIEW_QUESTIONS, Math.floor(questionCount)));
}

export function calculateInterviewTimeLimitSeconds(_questionCount: number) {
  return INTERVIEW_TIME_LIMIT_SECONDS;
}

function wordsIn(value: string) {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
}

function isSubstantiveAnswer(value: string) {
  const text = value.trim();
  const words = wordsIn(text);
  const meaningfulWords = words.filter((word) => !FILLER_WORDS.has(word));
  return text.length >= 12
    && words.length >= 3
    && new Set(meaningfulWords).size >= 2;
}

export function assessInterviewTranscript(
  transcript: InterviewTranscriptLine[],
  questionCount: number,
): InterviewTranscriptAssessment {
  const normalizedQuestionCount = normalizeInterviewQuestionCount(questionCount);
  const applicantAnswers = transcript
    .filter((line) => line?.role === "user" && typeof line.text === "string")
    .map((line) => String(line.text).trim())
    .filter(Boolean);
  const substantiveAnswers = applicantAnswers.filter(isSubstantiveAnswer);
  const combined = applicantAnswers.join(" ");
  const wordCount = wordsIn(combined).length;
  const characterCount = combined.replace(/\s/g, "").length;
  const requiredSubstantiveTurns = Math.max(
    1,
    Math.min(normalizedQuestionCount, Math.ceil(normalizedQuestionCount * 0.6)),
  );
  const minimumWords = Math.max(12, normalizedQuestionCount * 4);
  const minimumCharacters = Math.max(60, normalizedQuestionCount * 18);
  const eligible = substantiveAnswers.length >= requiredSubstantiveTurns
    && wordCount >= minimumWords
    && characterCount >= minimumCharacters;

  return {
    eligible,
    applicantTurns: applicantAnswers.length,
    substantiveTurns: substantiveAnswers.length,
    wordCount,
    characterCount,
    requiredSubstantiveTurns,
    minimumWords,
    minimumCharacters,
    message: eligible
      ? "Your spoken answers are ready to submit."
      : `Please answer the interview questions aloud with enough detail before submitting. At least ${requiredSubstantiveTurns} clear ${requiredSubstantiveTurns === 1 ? "answer is" : "answers are"} required.`,
  };
}

export function formatInterviewTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
