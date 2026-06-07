# Supabase Edge Function Deployment Guide

Follow these steps to deploy the `crop-triage` edge function to your production Supabase project.

---

### Step 1: Login to Supabase CLI
Open a terminal in the project directory (`shanmukha-kisan-sethu`) and run:
```bash
npx supabase login
```
Follow the prompts in your browser to authorize the Supabase CLI.

---

### Step 2: Set the Gemini API Key Secret
Set your Gemini API Key as a secure environment secret in your Supabase project. Run:
```bash
npx supabase secrets set GEMINI_API_KEY=your_gemini_api_key --project-ref voptaqjqwqyigkequgzt
```
*(Replace `your_gemini_api_key` with your actual Google Gemini API key).*

---

### Step 3: Deploy the Edge Function
Run the following command to deploy the function to production:
```bash
npx supabase functions deploy crop-triage --project-ref voptaqjqwqyigkequgzt
```

---

### Verification
Once deployed, the frontend application will automatically bypass the offline fallback mode and communicate directly with Google Gemini 2.0 Flash via your secure backend edge function!
