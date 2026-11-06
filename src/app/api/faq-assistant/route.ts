import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const stopWords = new Set(["about", "after", "again", "also", "and", "are", "can", "could", "does", "for", "from", "how", "into", "is", "the", "their", "there", "this", "what", "when", "where", "which", "with", "would", "you", "your"]);

function terms(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g)?.filter((term) => term.length > 2 && !stopWords.has(term)) ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsResult, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsResult?.claims;
  if (claimsError || typeof claims?.sub !== "string") {
    return NextResponse.json({ error: "Sign in to use the FAQ assistant." }, { status: 401, headers: noStore });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a question to continue." }, { status: 400, headers: noStore });
  }
  const question = payload && typeof payload === "object" && "question" in payload && typeof payload.question === "string"
    ? payload.question.trim()
    : "";
  if (question.length < 3 || question.length > 500) {
    return NextResponse.json({ error: "Please enter a question between 3 and 500 characters." }, { status: 400, headers: noStore });
  }

  const { data: faqs, error } = await supabase
    .from("faq_entries")
    .select("id, question, answer")
    .eq("is_published", true)
    .order("display_order")
    .limit(100);
  if (error) {
    return NextResponse.json({ error: "Published answers could not be loaded. Please try again." }, { status: 503, headers: noStore });
  }

  const queryTerms = terms(question);
  const matches = (faqs ?? []).map((faq) => {
    const faqQuestionTerms = terms(faq.question);
    const faqAnswerTerms = terms(faq.answer);
    const questionOverlap = [...queryTerms].filter((term) => faqQuestionTerms.has(term)).length;
    const answerOverlap = [...queryTerms].filter((term) => faqAnswerTerms.has(term)).length;
    const exactQuestionBonus = faq.question.toLowerCase().includes(question.toLowerCase()) ? 5 : 0;
    return {
      faq,
      score: questionOverlap * 3 + answerOverlap + exactQuestionBonus,
      overlap: questionOverlap + answerOverlap
    };
  }).filter(({ overlap }) => overlap >= (queryTerms.size < 2 ? 1 : Math.max(2, Math.ceil(queryTerms.size * 0.25))))
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);

  if (!matches.length) {
    return NextResponse.json({
      answer: "I could not find a close match in the published FAQs. Please open a support ticket so the team can help.",
      sources: []
    }, { headers: noStore });
  }

  const match = matches[0].faq;
  return NextResponse.json({
    answer: match.answer,
    sources: [{ id: match.id, question: match.question }]
  }, { headers: noStore });
}
