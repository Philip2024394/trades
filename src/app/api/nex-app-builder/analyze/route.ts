// NEX App Builder · Chat · POST /api/nex-app-builder/analyze (Philip 2026-08-14).
//
// Three modes based on request body:
//   { prompt }            → route intent, return starter template + first question
//   { blueprint, answer } → apply answer, return next question or ready-to-build
//   { blueprint }         → analyse current Blueprint, return next question
//
// Never fabricates. Never mutates Blueprints beyond the answer path.

import { NextResponse } from "next/server";
import { routeIntent, getStarterTemplateById, listStarterTemplates } from "@/lib/app-builder/chat/intent-router";
import { generateNextQuestion } from "@/lib/app-builder/chat/question-generator";
import { applyFact } from "@/lib/app-builder/chat/fact-applier";
import { runValidationWorker } from "@/lib/app-builder/workers/validation-worker";
import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body =
  | { mode: "welcome" }
  | { mode: "prompt"; prompt: string }
  | { mode: "answer"; blueprint: AppBlueprint; answer: { fieldPath: string; value: string } }
  | { mode: "analyze"; blueprint: AppBlueprint }
  | { mode: "pick-template"; templateId: string };

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  switch (body.mode) {
    case "welcome":
      return handleWelcome();
    case "prompt":
      return handlePrompt(body.prompt);
    case "pick-template":
      return handlePickTemplate(body.templateId);
    case "answer":
      return handleAnswer(body.blueprint, body.answer);
    case "analyze":
      return handleAnalyze(body.blueprint);
    default:
      return NextResponse.json({ ok: false, error: "unknown-mode" }, { status: 400 });
  }
}

function handleWelcome(): Response {
  const templates = listStarterTemplates().map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description
  }));
  return NextResponse.json({
    ok: true,
    kind: "welcome",
    say: "Hi. I can build you a website. Pick a category below, or tell me what your business does in your own words.",
    templates
  });
}

function handlePrompt(prompt: string): Response {
  if (!prompt || prompt.trim().length < 4) {
    return NextResponse.json({
      ok: true,
      say: "Tell me what kind of website you'd like — for example, \"I want a website for my staircase company\".",
      kind: "empty"
    });
  }
  const route = routeIntent(prompt);
  if (route.kind === "matched") {
    const bp = route.template.build();
    const question = generateNextQuestion(bp);
    return NextResponse.json({
      ok: true,
      kind: "matched",
      say: `Great — I can build a ${route.template.label.toLowerCase()} website. ${question ? "First, " + question.text.charAt(0).toLowerCase() + question.text.slice(1) : "I have everything I need."}`,
      template: { id: route.template.id, label: route.template.label, description: route.template.description },
      blueprint: bp,
      nextQuestion: question,
      readyToBuild: question === null
    });
  }
  if (route.kind === "ambiguous") {
    return NextResponse.json({
      ok: true,
      kind: "ambiguous",
      say: "That could match a few different templates — which sounds right?",
      candidates: route.candidates.map((c) => ({ id: c.id, label: c.label, description: c.description }))
    });
  }
  // unknown
  return NextResponse.json({
    ok: true,
    kind: "unknown",
    say: "I don't recognise that business type yet. Want to pick one of these to start?",
    suggestions: route.suggestions.map((c) => ({ id: c.id, label: c.label, description: c.description }))
  });
}

function handlePickTemplate(templateId: string): Response {
  const template = getStarterTemplateById(templateId);
  if (!template) return NextResponse.json({ ok: false, error: "unknown-template" }, { status: 400 });
  const bp = template.build();
  const question = generateNextQuestion(bp);
  return NextResponse.json({
    ok: true,
    kind: "matched",
    say: `Good — starting from the ${template.label.toLowerCase()} template. ${question ? question.text : "I have everything I need."}`,
    template: { id: template.id, label: template.label, description: template.description },
    blueprint: bp,
    nextQuestion: question,
    readyToBuild: question === null
  });
}

function handleAnswer(bp: AppBlueprint, answer: { fieldPath: string; value: string }): Response {
  const result = applyFact(bp, answer.fieldPath, answer.value);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      hint: "That didn't quite fit — could you try again?"
    }, { status: 400 });
  }
  const nextQuestion = generateNextQuestion(result.blueprint);
  const validation = runValidationWorker({ runId: "chat_after_answer", blueprint: result.blueprint });
  return NextResponse.json({
    ok: true,
    kind: "answered",
    say: nextQuestion ? nextQuestion.text : "That's everything I need — ready to build?",
    blueprint: result.blueprint,
    nextQuestion,
    readyToBuild: nextQuestion === null && validation.data.ready
  });
}

function handleAnalyze(bp: AppBlueprint): Response {
  const question = generateNextQuestion(bp);
  const validation = runValidationWorker({ runId: "chat_analyze_direct", blueprint: bp });
  return NextResponse.json({
    ok: true,
    kind: "analyzed",
    nextQuestion: question,
    readyToBuild: question === null && validation.data.ready,
    validation: {
      valid: validation.data.valid,
      ready: validation.data.ready,
      requiredFacts: validation.data.requiredFacts
    }
  });
}
