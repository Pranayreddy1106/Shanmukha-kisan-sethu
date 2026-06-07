// Deno Supabase Edge Function for Crop Disease Triage
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS Preflight Options Request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in Supabase environment secrets.");
    }

    const { action, image, knownCrops, cropName, problemsList, answers } = await req.json();

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // ─── ACTION 1: INITIATE TRIAGE ─────────────────────────────
    if (action === "initiate") {
      if (!image || !knownCrops) {
        throw new Error("Missing image or knownCrops parameters for initiate action.");
      }

      const cropsCatalog = knownCrops.map((c: any) => `- ${c.name_en} (ID: ${c.id})`).join("\n");
      const prompt = `You are a professional plant pathologist and agronomist. 
Analyze the uploaded image of a crop leaf or plant. 

First, determine which crop is shown in the image by matching it to one from this database list:
${cropsCatalog}

Next, identify potential diseases, insect pests, or nutrient deficiencies affecting this crop.
Finally, generate exactly 2 relevant, high-discriminating follow-up questions to help narrow down the diagnosis.
These questions should verify details not easily seen in the photo (e.g., texture, moisture, under-leaf symptoms, spread rate, soil details).
Make sure to provide translations for Telugu ("te") and Hindi ("hi") for both the questions and option labels.

You MUST respond with ONLY a valid JSON object matching this schema. Do not include markdown code fences, backticks, or any explanation:
{
  "matchedCropId": "<ID of the matched crop from the list above>",
  "cropName": {
    "en": "<Matched crop name in English>",
    "te": "<Telugu translation of crop name>",
    "hi": "<Hindi translation of crop name>"
  },
  "potentialProblems": [
    {
      "title": "<Name of potential disease/pest 1>",
      "reason": "<1 sentence reason why you suspect this>"
    },
    {
      "title": "<Name of potential disease/pest 2>",
      "reason": "<1 sentence reason why you suspect this>"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "text": {
        "en": "<Question text 1 in English>",
        "te": "<Question text 1 in Telugu>",
        "hi": "<Question text 1 in Hindi>"
      },
      "options": [
        {
          "label": {
            "en": "<Option 1 in English>",
            "te": "<Option 1 in Telugu>",
            "hi": "<Option 1 in Hindi>"
          },
          "value": "opt1"
        },
        {
          "label": {
            "en": "<Option 2 in English>",
            "te": "<Option 2 in Telugu>",
            "hi": "<Option 2 in Hindi>"
          },
          "value": "opt2"
        },
        {
          "label": {
            "en": "<Option 3 in English (e.g. Not Sure)>",
            "te": "<Option 3 in Telugu>",
            "hi": "<Option 3 in Hindi>"
          },
          "value": "unknown"
        }
      ]
    }
  ]
}`;

      const imagePart = {
        inlineData: { data: image, mimeType: "image/jpeg" }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const text = (await result.response).text().trim();

      let cleanJson = text;
      const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (codeBlockMatch) {
        cleanJson = codeBlockMatch[1].trim();
      }

      return new Response(cleanJson, {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ─── ACTION 2: CONFIRM DIAGNOSIS ───────────────────────────
    if (action === "confirm") {
      if (!image || !cropName || !problemsList || !answers) {
        throw new Error("Missing parameters for confirm action.");
      }

      const problemsCatalog = problemsList
        .map((p: any) => `- ${p.title_en} (ID: ${p.id}): ${p.description || "No description available."}`)
        .join("\n");

      const qaLogs = answers
        .map((a: any) => `Question: "${a.questionText}"\nFarmer Answer: "${a.answerLabel}" (value: "${a.answerValue}")`)
        .join("\n\n");

      const prompt = `You are a professional agronomist.
We have an image of a ${cropName} crop with symptoms.
To help diagnose the disease accurately, we asked the farmer the following follow-up questions:
${qaLogs}

Your task is to select the SINGLE most accurate problem from our database list that matches the visual symptoms in the image AND the farmer's answers:
${problemsCatalog}

Because we are combining visual analysis with farmer responses, the confidence score should be high.
IF the farmer's answers confirm the disease details, set the confidence to a value between 90 and 98 (inclusive). 
If it is healthy, map to the healthy state (problemType = "healthy", matchedProblemId = null or empty).

You MUST respond with ONLY a valid JSON object matching this schema. Do not include markdown code fences, backticks, or any explanation:
{
  "matchedProblemId": "<ID of the matched problem from the list above>",
  "problemName": {
    "en": "<Name of matched problem in English>",
    "te": "<Telugu translation of problem name>",
    "hi": "<Hindi translation of problem name>"
  },
  "problemType": "<one of: 'pest', 'disease', 'deficiency', 'healthy'>",
  "confidence": <integer between 90 and 98 representing final diagnosis certainty>,
  "description": {
    "en": "<2-3 sentence explanation of why this problem was diagnosed and what chemical/organic treatments are recommended in English>",
    "te": "<same description translated to Telugu>",
    "hi": "<same description translated to Hindi>"
  },
  "symptoms": [
    "<confirmed symptom 1 based on answers/image in English>",
    "<confirmed symptom 2 in English>",
    "<confirmed symptom 3 in English>"
  ],
  "severity": "<one of: 'low', 'medium', 'high', 'critical'>",
  "referenceImageKeywords": [
    "<search keyword 1>",
    "<search keyword 2>"
  ]
}

IMPORTANT RULES:
1. Always output ONLY the raw JSON.
2. The "matchedProblemId" must EXACTLY match the ID of the selected problem from the provided list. If the crop is healthy, set "matchedProblemId" to "healthy" or "".
3. Telugu and Hindi translations must be natural and accurate.
4. Set confidence to at least 90 (up to 98) since the farmer's answers resolved visual ambiguity.`;

      const imagePart = {
        inlineData: { data: image, mimeType: "image/jpeg" }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const text = (await result.response).text().trim();

      let cleanJson = text;
      const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (codeBlockMatch) {
        cleanJson = codeBlockMatch[1].trim();
      }

      return new Response(cleanJson, {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
