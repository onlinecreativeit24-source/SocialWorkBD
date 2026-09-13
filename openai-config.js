/* =========================================================
   OpenAI API Configuration
   SocialWorkBD - ChatGPT Integration
   ========================================================= */

(function() {
  "use strict";

  // ⚠️ SECURITY NOTE: Never expose your API key in client-side code!
  // This should be handled via a backend server/Cloud Function.
  // For production, use Firebase Cloud Functions as a proxy.

  const OPENAI_API_KEY = ""; // Set this via environment variable or backend proxy
  const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
  const OPENAI_MODEL = "gpt-3.5-turbo"; // or "gpt-4"

  /**
   * Initialize OpenAI (for server-side implementation)
   * Requires a backend Cloud Function to handle API calls securely
   */
  async function initializeOpenAI() {
    if (!OPENAI_API_KEY) {
      console.warn(
        "OpenAI API key not configured. Use Firebase Cloud Functions for secure API calls."
      );
      return false;
    }
    return true;
  }

  /**
   * Call OpenAI API via Backend Cloud Function (RECOMMENDED)
   * This keeps your API key secure
   */
  async function callOpenAIViaBackend(messages, maxTokens = 500) {
    try {
      // Call your Firebase Cloud Function instead
      const response = await fetch(
        "https://YOUR_PROJECT.cloudfunctions.net/openaiChat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: messages,
            maxTokens: maxTokens,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      return data.content || "";
    } catch (error) {
      console.error("Backend API call failed:", error);
      throw error;
    }
  }

  /**
   * Generate job description using OpenAI
   * Example: Help clients create better job postings
   */
  async function generateJobDescription(jobTitle, skills, budget) {
    const prompt = `
You are a professional job posting assistant for a Bangladeshi freelance marketplace.
Create a compelling job description for:
- Title: ${jobTitle}
- Required Skills: ${skills}
- Budget: $${budget}

Provide a clear, professional description that will attract quality freelancers.
    `.trim();

    const messages = [
      {
        role: "system",
        content:
          "You are a professional job posting assistant for a freelance marketplace.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      const response = await callOpenAIViaBackend(messages, 300);
      return response;
    } catch (error) {
      console.error("Job description generation failed:", error);
      throw error;
    }
  }

  /**
   * Analyze proposal quality using OpenAI
   * Help match best proposals to jobs
   */
  async function analyzeProposal(proposal, jobDescription) {
    const prompt = `
Analyze this freelancer proposal for quality and fit:

Job Description: ${jobDescription}

Proposal: ${proposal}

Provide:
1. Quality score (1-10)
2. Relevance to job
3. Key strengths
4. Potential concerns
    `.trim();

    const messages = [
      {
        role: "system",
        content: "You are an expert proposal analyst for a freelance marketplace.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      const response = await callOpenAIViaBackend(messages, 250);
      return response;
    } catch (error) {
      console.error("Proposal analysis failed:", error);
      throw error;
    }
  }

  /**
   * Generate profile improvement suggestions
   * Help workers optimize their profiles
   */
  async function generateProfileSuggestions(profile) {
    const prompt = `
Provide 3-5 suggestions to improve this freelancer profile:

Name: ${profile.name}
Title: ${profile.title}
Skills: ${profile.skills}
Bio: ${profile.bio}

Provide actionable, specific suggestions to make the profile more attractive.
    `.trim();

    const messages = [
      {
        role: "system",
        content:
          "You are a career coach for freelancers on a marketplace platform.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      const response = await callOpenAIViaBackend(messages, 300);
      return response;
    } catch (error) {
      console.error("Profile suggestions generation failed:", error);
      throw error;
    }
  }

  /**
   * AI-powered skill recommendation
   * Suggest skills based on profile
   */
  async function recommendSkills(currentSkills, experience) {
    const prompt = `
Based on the following information, recommend 5-7 complementary skills:
- Current Skills: ${currentSkills}
- Experience: ${experience}

List skills that would increase marketability on a freelance platform.
    `.trim();

    const messages = [
      {
        role: "system",
        content:
          "You are an expert in freelance marketplace skills and career development.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      const response = await callOpenAIViaBackend(messages, 200);
      return response;
    } catch (error) {
      console.error("Skill recommendation failed:", error);
      throw error;
    }
  }

  /**
   * Message improvement assistant
   * Help workers and clients write better messages
   */
  async function improveMessage(originalMessage, context = "") {
    const prompt = `
Improve this message for a professional freelance marketplace:

Original: "${originalMessage}"
${context ? `Context: ${context}` : ""}

Provide an improved version that is:
- Professional and courteous
- Clear and concise
- More likely to get a positive response
    `.trim();

    const messages = [
      {
        role: "system",
        content:
          "You are a professional communication coach for freelance marketplace users.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      const response = await callOpenAIViaBackend(messages, 200);
      return response;
    } catch (error) {
      console.error("Message improvement failed:", error);
      throw error;
    }
  }

  // Expose functions globally
  window.openaiService = {
    initialize: initializeOpenAI,
    generateJobDescription: generateJobDescription,
    analyzeProposal: analyzeProposal,
    generateProfileSuggestions: generateProfileSuggestions,
    recommendSkills: recommendSkills,
    improveMessage: improveMessage,
  };
})();
