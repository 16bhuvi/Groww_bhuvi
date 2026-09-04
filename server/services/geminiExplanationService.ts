import { GoogleGenAI } from '@google/genai';
import { MeaningfulChangeResult, StockNews } from '../types/index.js';

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0 || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
    });
  }
  return aiClient;
}

export interface ExplanationResponse {
  summary: string;
  source: 'GEMINI' | 'DETERMINISTIC_ENGINE';
  highlights: string[];
}

/**
 * Gemini-powered explanation layer.
 * Strictly adheres to architectural guidelines:
 * - Deterministic scoring remains the single source of truth.
 * - Operates purely as an explanation layer.
 * - Never makes financial advice, buy/sell predictions, or invents facts.
 * - Graceful fallback to deterministic engine on failure or missing key.
 */
export async function generateStockExplanation(
  changeResult: MeaningfulChangeResult,
  recentNews: StockNews[] = []
): Promise<ExplanationResponse> {
  const deterministicFallback: ExplanationResponse = {
    summary: changeResult.why_it_matters.slice(0, 3).join(' ') ||
      `${changeResult.symbol} is trading normally within its expected volatility and moving average bands.`,
    source: 'DETERMINISTIC_ENGINE',
    highlights: changeResult.since_last_checked_summary.length > 0
      ? changeResult.since_last_checked_summary
      : changeResult.why_it_matters.slice(0, 3),
  };

  const ai = getGenAI();
  if (!ai) {
    return deterministicFallback;
  }

  try {
    const newsContext = recentNews
      .slice(0, 4)
      .map(n => `- "${n.title}" (${n.source}, sentiment: ${n.sentiment})`)
      .join('\n');

    const signalsContext = changeResult.signals
      .filter(s => s.points > 0)
      .map(s => `- ${s.label} (${s.points}/${s.max_points} pts): ${s.details}`)
      .join('\n');

    const prompt = `You are a factual market explanation layer for Groww Smart Watchlist.
Answer: "What meaningfully changed in ${changeResult.company_name} (${changeResult.symbol}) since the user last checked, and why does it warrant attention?"

FACTUAL DATA:
- Current Price: ₹${changeResult.current_price.toLocaleString('en-IN')}
- Intraday Day Change: ${changeResult.day_change_percent >= 0 ? '+' : ''}${changeResult.day_change_percent.toFixed(2)}%
- Change Since User Last Checked: ${
      changeResult.is_first_visit
        ? "First visit (no prior observation baseline)"
        : `${changeResult.change_since_last_seen_percent !== null ? (changeResult.change_since_last_seen_percent >= 0 ? '+' : '') + changeResult.change_since_last_seen_percent.toFixed(2) + '%' : 'Unchanged'}`
    }
- Attention Score: ${changeResult.change_score}/100 (${changeResult.attention_level})
- Volume Ratio: ${changeResult.volume_ratio}x 20-day average
- 50 DMA: ₹${changeResult.dma_50} | 200 DMA: ₹${changeResult.dma_200} | RSI: ${changeResult.rsi_14}
- Detected Technical & Event Signals:
${signalsContext || '- No abnormal threshold breaches'}
- Recent News Articles:
${newsContext || '- No major recent news items'}

INSTRUCTIONS:
1. Synthesize this data into exactly 2 to 3 objective, executive-level sentences.
2. Answer clearly what changed and why it matters.
3. STRICT PROHIBITIONS:
   - NEVER make financial predictions (e.g. do NOT say "will rise", "target price", "buy", "sell", "opportunity").
   - NEVER fabricate numbers or data outside what is provided.
   - Use objective market terms like "trading activity expanded", "crossed moving average", "margin pressure reported".
4. Keep the tone calm, professional, and informative.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    clearTimeout(timeout);

    const text = response.text?.trim();
    if (text && text.length > 20) {
      return {
        summary: text,
        source: 'GEMINI',
        highlights: changeResult.since_last_checked_summary.length > 0
          ? changeResult.since_last_checked_summary
          : changeResult.why_it_matters.slice(0, 3),
      };
    }

    return deterministicFallback;
  } catch {
    // Silent recovery: always return deterministic fallback
    return deterministicFallback;
  }
}
