const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Trading Pairs Configuration
const TRADING_PAIRS = {
  crypto: [
    { symbol: 'BTC/USDT', name: 'Bitcoin' },
    { symbol: 'ETH/USDT', name: 'Ethereum' },
    { symbol: 'XRP/USDT', name: 'Ripple' },
    { symbol: 'ADA/USDT', name: 'Cardano' },
    { symbol: 'SOL/USDT', name: 'Solana' }
  ],
  forex: [
    { symbol: 'EUR/USD', name: 'Euro/Dollar' },
    { symbol: 'GBP/USD', name: 'Pound/Dollar' },
    { symbol: 'USD/JPY', name: 'Dollar/Yen' },
    { symbol: 'AUD/USD', name: 'Aussie/Dollar' },
    { symbol: 'USD/CAD', name: 'Dollar/Canadian' }
  ],
  otc: [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'GOOGL', name: 'Google' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'TSLA', name: 'Tesla' }
  ]
};

// Technical Indicators
class TechnicalIndicators {
  // RSI - Relative Strength Index
  static RSI(prices, period = 14) {
    const deltas = [];
    for (let i = 1; i < prices.length; i++) {
      deltas.push(prices[i] - prices[i - 1]);
    }
    const ups = deltas.filter(d => d > 0).slice(-period).reduce((a, b) => a + b, 0) / period;
    const downs = deltas.filter(d => d < 0).slice(-period).map(d => Math.abs(d)).reduce((a, b) => a + b, 0) / period;
    const rs = ups / downs;
    return 100 - (100 / (1 + rs));
  }

  // MACD - Moving Average Convergence Divergence
  static MACD(prices) {
    const ema12 = TechnicalIndicators.EMA(prices, 12);
    const ema26 = TechnicalIndicators.EMA(prices, 26);
    const macd = ema12 - ema26;
    return { macd, ema12, ema26 };
  }

  // EMA - Exponential Moving Average
  static EMA(prices, period) {
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  // SMA - Simple Moving Average
  static SMA(prices, period) {
    return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  // Bollinger Bands
  static BollingerBands(prices, period = 20, stdDev = 2) {
    const sma = TechnicalIndicators.SMA(prices, period);
    const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper: sma + (std * stdDev),
      middle: sma,
      lower: sma - (std * stdDev)
    };
  }

  // Stochastic Oscillator
  static Stochastic(prices, period = 14) {
    const lowest = Math.min(...prices.slice(-period));
    const highest = Math.max(...prices.slice(-period));
    const k = ((prices[prices.length - 1] - lowest) / (highest - lowest)) * 100;
    return k;
  }

  // VWAP - Volume Weighted Average Price
  static VWAP(prices, volumes) {
    let numerator = 0, denominator = 0;
    for (let i = 0; i < prices.length; i++) {
      numerator += prices[i] * volumes[i];
      denominator += volumes[i];
    }
    return numerator / denominator;
  }

  // ATR - Average True Range
  static ATR(prices, period = 14) {
    const trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
      const tr = Math.max(
        prices[i] - prices[i - 1],
        Math.abs(prices[i] - prices[i - 1]),
        Math.abs(prices[i - 1] - prices[i])
      );
      trueRanges.push(tr);
    }
    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  // CCI - Commodity Channel Index
  static CCI(prices, period = 20) {
    const sma = TechnicalIndicators.SMA(prices, period);
    const mad = prices.slice(-period).reduce((sum, price) => sum + Math.abs(price - sma), 0) / period;
    return (prices[prices.length - 1] - sma) / (0.015 * mad);
  }

  // Williams %R
  static WilliamsR(prices, period = 14) {
    const highest = Math.max(...prices.slice(-period));
    const lowest = Math.min(...prices.slice(-period));
    return -100 * (highest - prices[prices.length - 1]) / (highest - lowest);
  }

  // Momentum
  static Momentum(prices, period = 10) {
    return prices[prices.length - 1] - prices[prices.length - 1 - period];
  }
}

// Trading Patterns
class TradingPatterns {
  static detectHeadAndShoulders(prices) {
    if (prices.length < 5) return false;
    const n = prices.length;
    const shoulder1 = prices[n - 5];
    const head = prices[n - 3];
    const shoulder2 = prices[n - 1];
    return head > shoulder1 * 1.02 && head > shoulder2 * 1.02 && Math.abs(shoulder1 - shoulder2) < shoulder1 * 0.02;
  }

  static detectDoubleTop(prices) {
    if (prices.length < 5) return false;
    const peak1 = Math.max(...prices.slice(-5, -2));
    const peak2 = Math.max(...prices.slice(-3));
    return Math.abs(peak1 - peak2) < peak1 * 0.02 && peak1 > prices[prices.length - 1];
  }

  static detectDoubleBottom(prices) {
    if (prices.length < 5) return false;
    const bottom1 = Math.min(...prices.slice(-5, -2));
    const bottom2 = Math.min(...prices.slice(-3));
    return Math.abs(bottom1 - bottom2) < bottom1 * 0.02 && bottom1 < prices[prices.length - 1];
  }

  static detectAscendingTriangle(prices) {
    if (prices.length < 5) return false;
    const highs = prices.slice(-5);
    const lows = prices.slice(-5);
    const highTrend = highs[highs.length - 1] > highs[0];
    const lowTrend = Math.abs(lows[lows.length - 1] - lows[0]) < lows[0] * 0.01;
    return highTrend && lowTrend;
  }

  static detectDescendingTriangle(prices) {
    if (prices.length < 5) return false;
    const highs = prices.slice(-5);
    const lows = prices.slice(-5);
    const highTrend = Math.abs(highs[highs.length - 1] - highs[0]) < highs[0] * 0.01;
    const lowTrend = lows[lows.length - 1] < lows[0];
    return highTrend && lowTrend;
  }

  static detectWedge(prices) {
    if (prices.length < 5) return false;
    const range = Math.max(...prices.slice(-5)) - Math.min(...prices.slice(-5));
    const trend = prices[prices.length - 1] > prices[prices.length - 5];
    return range < Math.min(...prices.slice(-5)) * 0.03 && trend;
  }

  static detectFlagPattern(prices) {
    if (prices.length < 7) return false;
    const pole = Math.abs(prices[prices.length - 5] - prices[prices.length - 7]);
    const flag = Math.max(...prices.slice(-5)) - Math.min(...prices.slice(-5));
    return flag < pole * 0.33 && flag > 0;
  }

  static detectPennant(prices) {
    if (prices.length < 7) return false;
    const highs = prices.slice(-5);
    const lows = prices.slice(-5);
    const highTrend = Math.abs(highs[highs.length - 1] - highs[0]) < highs[0] * 0.02;
    const lowTrend = Math.abs(lows[lows.length - 1] - lows[0]) < lows[0] * 0.02;
    return highTrend && lowTrend;
  }

  static detectCup(prices) {
    if (prices.length < 5) return false;
    const left = prices[prices.length - 5];
    const right = prices[prices.length - 1];
    const bottom = Math.min(...prices.slice(-3));
    return Math.abs(left - right) < left * 0.02 && bottom < left * 0.98;
  }

  static detectRectangle(prices) {
    if (prices.length < 5) return false;
    const high = Math.max(...prices.slice(-5));
    const low = Math.min(...prices.slice(-5));
    const range = high - low;
    return range < high * 0.03;
  }

  static detectGapUp(prices) {
    if (prices.length < 2) return false;
    return prices[prices.length - 1] > prices[prices.length - 2] * 1.015;
  }
}

// Signal Generator
class SignalGenerator {
  static generateSignal(prices, pair) {
    if (prices.length < 30) return { signal: 'INSUFFICIENT_DATA', confidence: 0 };

    const indicators = {
      rsi: TechnicalIndicators.RSI(prices),
      macd: TechnicalIndicators.MACD(prices),
      bb: TechnicalIndicators.BollingerBands(prices),
      stochastic: TechnicalIndicators.Stochastic(prices),
      cci: TechnicalIndicators.CCI(prices),
      williamsr: TechnicalIndicators.WilliamsR(prices),
      momentum: TechnicalIndicators.Momentum(prices)
    };

    const patterns = {
      headAndShoulders: TradingPatterns.detectHeadAndShoulders(prices),
      doubleTop: TradingPatterns.detectDoubleTop(prices),
      doubleBottom: TradingPatterns.detectDoubleBottom(prices),
      ascendingTriangle: TradingPatterns.detectAscendingTriangle(prices),
      descendingTriangle: TradingPatterns.detectDescendingTriangle(prices),
      wedge: TradingPatterns.detectWedge(prices),
      flag: TradingPatterns.detectFlagPattern(prices),
      pennant: TradingPatterns.detectPennant(prices),
      cup: TradingPatterns.detectCup(prices),
      rectangle: TradingPatterns.detectRectangle(prices)
    };

    // Generate signal based on indicators and patterns
    let buyScore = 0, sellScore = 0;

    // RSI Analysis
    if (indicators.rsi < 30) buyScore += 2;
    else if (indicators.rsi > 70) sellScore += 2;

    // MACD Analysis
    if (indicators.macd.macd > 0) buyScore += 1;
    else sellScore += 1;

    // Bollinger Bands Analysis
    if (prices[prices.length - 1] < indicators.bb.lower) buyScore += 1.5;
    else if (prices[prices.length - 1] > indicators.bb.upper) sellScore += 1.5;

    // Stochastic Analysis
    if (indicators.stochastic < 20) buyScore += 1;
    else if (indicators.stochastic > 80) sellScore += 1;

    // CCI Analysis
    if (indicators.cci < -100) buyScore += 1;
    else if (indicators.cci > 100) sellScore += 1;

    // Pattern Analysis
    Object.values(patterns).forEach(pattern => {
      if (pattern === true) buyScore += 0.5;
    });

    const totalScore = buyScore + sellScore;
    let signal = 'HOLD';
    let confidence = 0;

    if (totalScore > 0) {
      if (buyScore > sellScore) {
        signal = 'BUY';
        confidence = Math.min(100, (buyScore / totalScore) * 100);
      } else if (sellScore > buyScore) {
        signal = 'SELL';
        confidence = Math.min(100, (sellScore / totalScore) * 100);
      }
    }

    return {
      signal,
      confidence: Math.round(confidence),
      indicators,
      patterns,
      pair,
      timestamp: new Date(),
      currentPrice: prices[prices.length - 1]
    };
  }
}

// Generate mock price data
function generateMockPrices(length = 50) {
  const prices = [100];
  for (let i = 1; i < length; i++) {
    const change = (Math.random() - 0.5) * 2;
    prices.push(Math.max(prices[i - 1] * (1 + change / 100), 1));
  }
  return prices;
}

// Routes
app.get('/api/trading-pairs', (req, res) => {
  res.json(TRADING_PAIRS);
});

app.get('/api/signal/:category/:pair', (req, res) => {
  const { category, pair } = req.params;
  const prices = generateMockPrices(50);
  const signal = SignalGenerator.generateSignal(prices, pair);
  res.json(signal);
});

app.post('/api/analyze', (req, res) => {
  const { pairs, indicators: selectedIndicators, patterns: selectedPatterns } = req.body;
  const results = [];

  pairs.forEach(pair => {
    const prices = generateMockPrices(50);
    const signal = SignalGenerator.generateSignal(prices, pair);
    results.push(signal);
  });

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Trading Signals Bot running on http://localhost:${PORT}`);
});
