
## Complete Design Document v2.0
*Building on your existing Astro project + Supabase setup*

---

## 🎯 Vision Statement

**"The most beautiful, tactile way to explore AI model pricing and benchmarks"**

A dark-mode, glassmorphic dashboard that transforms complex model data into instant insights. Built for AI engineers, researchers, and cost-optimizers who demand both beauty and precision. In 2024, designers are focusing on creating dashboards with sleek dark mode options while ensuring that all visualizations and text remain clear and readable, and Glassmorphism represents a significant shift in UI design, offering a fresh approach to creating depth and focus in digital interfaces.

---

## 📊 Success Metrics & Modern Standards

| Goal | KPI | Target | 2024 Benchmark |
|------|-----|--------|----------------|
| Instant insights | Time-to-first-insight | < 1.8s | Modern dashboard design will focus on clear and concise communication of key findings |
| Effortless comparison | Compare flow completion | > 95% | Industry leader standard |
| Premium feel | User engagement depth | > 4 views/session | Using visuals to present data makes it super easy for users to view data and make decisions |
| Technical excellence | Lighthouse Performance | > 98 | 90% of websites have already implemented responsive design today |
| Data Processing | Chart render time | < 200ms | Instant visual feedback |

---

## 🎨 Visual Identity & Modern Glassmorphism

### Color System (2024 Dark Mode Standard)
Primary Palette (Dark Mode Optimized)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Surface-0     #000100    ████████████████  Root background (true black for OLED)
Glass-Base    #0A0A0B    ████████████████  Glass card base (subtle lift from black)
Glass-Tint    #A1A6B412  ████████████████  Frost overlay (18% opacity - enhanced depth)
Stroke-Soft   #A1A6B425  ████████████████  Subtle borders (25% opacity)
Stroke-Strong #A1A6B460  ████████████████  Active borders (60% opacity)
Accent-1      #94C5CC    ████████████████  Primary interactive (cool cyan)
Accent-2      #B4D2E7    ████████████████  Data positive (sky blue)
Accent-Warn   #F4A261    ████████████████  Warning/attention (warm orange)
Text-Primary  #F8F8F8    ████████████████  High contrast text
Text-Secondary #A1A6B4   ████████████████  Secondary text (perfect contrast)
Text-Tertiary #6B7280    ████████████████  Tertiary text/labels

### Advanced Glassmorphism System
Glassmorphism represents a significant shift in UI design and is characterized by the use of transparency, blur effects, and vibrant backgrounds to create a frosted glass appearance, perfect for dashboard designs.

```css
/* Level 1: Navigation & Primary Cards */
.glass-level-1 {
  background: rgba(10, 10, 11, 0.8);
  backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid rgba(161, 166, 180, 0.25);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Level 2: Modals & Overlays */
.glass-level-2 {
  background: rgba(10, 10, 11, 0.85);
  backdrop-filter: blur(32px) saturate(2.0);
  border: 1px solid rgba(148, 197, 204, 0.3);
  box-shadow: 
    0 16px 64px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* Level 3: Floating Elements */
.glass-level-3 {
  background: rgba(148, 197, 204, 0.08);
  backdrop-filter: blur(24px) saturate(1.5);
  border: 1px solid rgba(148, 197, 204, 0.2);
  box-shadow: 
    0 12px 48px rgba(148, 197, 204, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
Typography System

Font Family: NebulaSans (existing project standard)
Weights: 400 Regular / 600 SemiBold / 800 ExtraBold
Scale: Modular scale 1.25 ratio

Display: 40px (2.5rem) - Hero numbers
H1: 32px (2rem) - Section titles
H2: 26px (1.625rem) - Card titles
H3: 20px (1.25rem) - Component labels
Body: 16px (1rem) - Primary text
Small: 14px (0.875rem) - Secondary text
Caption: 12px (0.75rem) - Micro labels


Line Heights: 1.6 for body, 1.2 for headings
Letter Spacing: -0.025em for large text, 0.025em for small


🏗️ Architecture & Project Integration
Existing Project Setup
Since you already have:

✅ Astro project initialized
✅ .env file with Supabase credentials
✅ Database schema implemented

Enhanced Site Structure
/                    → Dashboard (primary experience)
/compare             → Side-by-side comparison matrix
/benchmark/{suite}   → Deep-dive benchmark analysis (MMLU, MT-Bench, etc.)
/model/{id}          → Individual model deep-dive
/trends              → Price & performance trends over time
/api/
  ├── models         → Dashboard data endpoint
  ├── compare        → Comparison matrix data
  ├── benchmarks     → Benchmark-specific data
  └── trends         → Historical data
Modern Navigation Pattern
Modern dashboard design focuses on sleek dark mode options with clear communication of key findings, so we'll use a floating glass navigation bar:
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔮 Logo    Dashboard • Compare • Benchmarks • Trends        🌙 Theme  ⚙️   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Active tab gets animated sliding glass indicator with glow effect          │
│  Breadcrumb trail for deep navigation: Dashboard > MMLU > Claude vs GPT     │
└─────────────────────────────────────────────────────────────────────────────┘

📱 Revolutionary Interface Design
1. Enhanced Dashboard View (Primary Experience)
Modern dashboard design emphasizes big, bold numbers and clear data communication. Here's our evolved layout:
Master Layout Grid
┌─────────────────────────────────────────────────────────────────────────────┐
│  Floating Glass Navigation                                                  │
├─────────────────────┬───┬───────────────────────────────────────────────────┤
│                     │   │                                                   │
│   Smart Filter      │ T │            Enhanced Chart Canvas                 │
│   Rail (320px)      │ O │          (Intelligent Dual-Bar System)          │
│                     │ G │                                                   │
│   • AI Suggestions  │ G │   ┌─────────────────────────────────────────┐   │
│   • Benchmark Tog   │ L │   │  Big Bold Numbers (Cost Leaders)       │   │
│   • Price Ranges    │ E │   │  $0.25  $1.25  $0.50                  │   │
│   • Model Search    │   │   │  Input  Output  Combo                  │   │
│   • Smart Filters   │ B │   └─────────────────────────────────────────┘   │
│                     │ A │                                                   │
│   Selected Models   │ R │   Interactive Bars with Live Tooltips            │
│   ┌───────────────┐ │   │   • Hover: Detailed metrics popup               │
│   │ Compare (3/6) │ │   │   • Click: Add to comparison                     │
│   │ ✨ Analyze    │ │   │   • Double-click: Model deep-dive               │
│   └───────────────┘ │   │                                                   │
├─────────────────────┴───┴───────────────────────────────────────────────────┤
│                                                                             │
│   AI-Powered Insights Bar                                                  │
│   "💡 Claude 4 Sonnet offers 80% cost savings vs GPT-4 for similar MMLU"   │
└─────────────────────────────────────────────────────────────────────────────┘
Revolutionary Filter Rail Features
Modern users need information at a glance, so we limit clutter and draw attention to key metrics:

AI-Powered Suggestions 🤖
┌─────────────────────────────┐
│ 🎯 Smart Recommendations   │
├─────────────────────────────┤
│ Best Value: Claude 4 Sonnet │
│ Cheapest: Gemini 2.0 Flash │
│ Highest MMLU: GPT-4o       │
│ Trending: DeepSeek V3       │
└─────────────────────────────┘

Dynamic Benchmark Toggle
Glassmorphism is used in dashboards to create clean interfaces enhancing data visualization:
Token Cost • MMLU • MT-Bench • SWE-Bench • HumanEval • LiveCodeBench
[====•====]  Glass slider with spring physics

Intelligent Price Filters
┌─────────────────────────────┐
│ Price Range (per 1M tokens) │
├─────────────────────────────┤
│ Budget     $0 - $5          │
│ Standard   $5 - $15         │
│ Premium    $15 - $50        │
│ Enterprise $50+             │
│                             │
│ [====•--•====] $2.50-$12.50│
└─────────────────────────────┘

Advanced Model Search
┌─────────────────────────────┐
│ 🔍 Search models...         │
├─────────────────────────────┤
│ ✓ GPT-4o family (5)         │
│ ✓ Claude 4 family (3)       │
│ ✓ Gemini family (4)         │
│ □ DeepSeek family (2)       │
│ □ Qwen family (3)           │
│                             │
│ [Select All] [Clear]        │
└─────────────────────────────┘


Next-Gen Chart System
Presenting data helps users see what's important instantly, following modern visualization principles:
Big Numbers Hero Section
Cost Leaders Today
┌──────────┬──────────┬──────────┐
│  INPUT   │  OUTPUT  │  TOTAL   │
│  $0.15   │  $0.60   │  $0.75   │
│ per 1M   │ per 1M   │ per 1M   │
└──────────┴──────────┴──────────┘
DeepSeek V3 • Updated 2 hours ago
Enhanced Dual-Bar Visualization

Input costs: Accent-1 gradient (#94C5CC → #7AB8BF)
Output costs: Accent-2 gradient (#B4D2E7 → #9BC7E0)
Smart bar grouping by model family
Live animation on data updates
Responsive hover states with detailed metrics

Revolutionary Nerd Panel 3.0
Slides in from right with advanced glassmorphic physics:
┌─────────────────────────────────────┐
│ 🧠 GPT-4o Mini Deep Dive           │
├─────────────────────────────────────┤
│ Context Window    128K tokens       │
│ Parameters        ~8B (estimated)   │
│ Architecture      Transformer       │
│ Training Cutoff   Apr 2024         │
│ Release Date      Jul 18, 2024     │
│                                     │
│ 📊 Performance Radar               │
│      Reasoning                      │
│         ●                           │
│   Code    ●    Math                │
│         ●                           │
│    Language  Creative               │
│                                     │
│ 💰 Cost Efficiency Score: 9.2/10   │
│ 🏆 Best for: High-volume tasks     │
└─────────────────────────────────────┘
2. Revolutionary Comparison Tool 2.0
Taking inspiration from modern dashboard trends, our comparison tool becomes a sophisticated analysis workspace:
Enhanced Matrix Layout
┌─────────────────────────────────────────────────────────────────────────────┐
│  Selected Models (Drag to Reorder)                        [Export] [Share]  │
│  [Claude 4 Sonnet] [GPT-4o] [Gemini 2.0 Pro] [+ Add Model]                │
├─────────────────────────────────────────────────────────────────────────────┤
│                     │ Claude 4  │ GPT-4o   │ Gemini 2.0│ Winner            │
├─────────────────────┼───────────┼──────────┼───────────┼─────────────────  │
│ 💰 Input (¢/1k)     │   0.30 🥈 │   0.50   │   0.25 🏆 │ 16% cheaper       │
│ 💰 Output (¢/1k)    │   1.50 🏆 │   1.50 🏆 │   0.75 🥇 │ 50% cheaper       │
│ 🧠 MMLU (%)         │   89 🥇   │   87 🥈  │   84 🥉  │ 6% advantage       │
│ 💻 HumanEval (%)    │   92 🏆   │   90 🥈  │   87 🥉  │ 6% advantage       │
│ ⚡ Speed (tok/s)     │   85      │   120 🏆 │   95 🥈  │ 41% faster         │
│ 📖 Context (K)      │   200 🏆  │   128 🥈 │  2000 🥇 │ 1000% larger      │
│ 🔧 Parameters (B)   │    ?      │    ?     │     ?    │ Unknown            │
│ 📅 Release         │ 2024-10   │ 2024-05  │ 2024-12  │ Most recent        │
└─────────────────────┴───────────┴──────────┴───────────┴─────────────────  │
│                                                                             │
│  💡 AI Insights: "Claude 4 best for reasoning, Gemini 2.0 for long docs"   │
│  📊 Total Cost for 1M tokens: Claude $1.80 • GPT-4o $2.00 • Gemini $1.00  │
└─────────────────────────────────────────────────────────────────────────────┘
Advanced Comparison Features

Winner Highlighting: Automatic detection of best values per metric
Smart Insights: AI-generated comparison summaries
Cost Calculator: Real-world usage projections
Performance Radar: Multi-dimensional capability view
Trend Analysis: Show performance changes over time
Export Options: PNG, PDF, CSV, shareable links


🗄️ Database Integration
Supabase Schema (Filtered Views)
sql-- Core view for LLM/Multimodal models only
CREATE VIEW vw_model_explorer AS
SELECT 
  m.id,
  m.name,
  m.short_name,
  m.family_id,
  m.creator_id,
  m.release_date,
  m.context_tokens,
  m.params_b,
  
  -- Pricing
  p.input_per_1k_usd,
  p.output_per_1k_usd,
  p.refreshed_at,
  
  -- Benchmarks (aggregated)
  jsonb_object_agg(
    b.suite, 
    jsonb_build_object(
      'score', b.score,
      'unit', b.unit,
      'rank', b.rank
    )
  ) FILTER (WHERE b.suite IS NOT NULL) AS benchmarks,
  
  -- Creator info
  c.name as creator_name,
  
  -- Family info  
  f.name as family_name

FROM models m
LEFT JOIN prices p ON p.model_id = m.id
LEFT JOIN benchmarks b ON b.model_id = m.id
LEFT JOIN model_creators c ON c.id = m.creator_id
LEFT JOIN model_families f ON f.id = m.family_id

WHERE m.model_type IN ('LLM', 'Multimodal')
GROUP BY m.id, p.input_per_1k_usd, p.output_per_1k_usd, 
         p.refreshed_at, c.name, f.name;
API Endpoints
typescript// Dashboard data
GET /api/models
Query: ?benchmark=mmlu&range=low,mid&search=claude

// Comparison data  
GET /api/compare
Query: ?ids=uuid1,uuid2,uuid3

// Benchmark deep-dive
GET /api/benchmarks/{suite}
Query: ?models=uuid1,uuid2

🎭 Component Library
Interactive Elements
1. Button System
Primary Button
- Background: linear-gradient(135deg, #94C5CC, #B4D2E7)
- Hover: lift 2px + glow
- States: default, hover, active, disabled

Secondary Button  
- Background: glass (level 1)
- Border: 1px solid stroke
- Hover: border → accent-1

Tertiary Button
- Background: transparent
- Color: accent-1
- Hover: background glass tint
2. Form Controls
Toggle Switch
- Track: glass background
- Thumb: accent-1 with subtle shadow
- Animation: spring (stiffness: 400)

Slider
- Track: stroke color
- Range: accent-1 gradient
- Thumbs: white with accent-1 glow

Checkbox/Radio
- Unchecked: stroke border
- Checked: accent-1 background + checkmark
- Animation: scale + fade
3. Data Visualization
Bar Chart
- Input bars: accent-1 (#94C5CC)
- Output bars: accent-2 (#B4D2E7)
- Hover: lift 4px + shadow
- Selection: stroke accent-1 2px

Heatmap Cells
- Range: transparent → accent-2
- Text: white on dark cells, surface-0 on light
- Transition: 200ms ease-out

⚡ Motion & Interactions
Animation System
Timing Functions
- Ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94)
- Spring: cubic-bezier(0.68, -0.55, 0.265, 1.55)
- Bounce: cubic-bezier(0.68, -0.6, 0.32, 1.6)

Duration Scale
- Micro (hover): 150ms
- Small (toggles): 250ms  
- Medium (drawers): 350ms
- Large (page transitions): 500ms
Tactile Feedback

Hover States: 4px lift + shadow bloom
Click: Brief scale down (0.98) + spring back
Selection: Pulse accent-1 glow
Loading: Skeleton shimmer animation
Error: Subtle shake + red accent

Sound Design (Optional)

Toggle: Soft click (44ms)
Selection: Gentle chime
Error: Muted buzz
Success: Light ding
Respects prefers-reduced-motion