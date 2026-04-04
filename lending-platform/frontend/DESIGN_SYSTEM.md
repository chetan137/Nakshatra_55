=== LENDCHAIN DESIGN SYSTEM ===

--- Color Palette ---

Primary background: #FF8C69 (salmon/orange — like MetaMask's homepage)
Secondary background: #FF7A55 (slightly darker orange for sections)
Card background: #FFFFFF (pure white)
Dark card background: #1A1040 (deep dark purple — for highlighted cards)

Primary accent: #2D1B69 (dark purple — main buttons, headings on light bg)
Secondary accent: #6B4EFF (bright purple — hover states, links, badges)
Success: #00C896
Warning: #FFB547
Error: #FF4D4D
Text primary on orange bg: #1A1040 (dark purple — never black)
Text secondary on orange bg: #3D2B7A
Text on white cards: #1A1040
Text muted on white cards: #6B7280
Text on dark purple cards: #FFFFFF
Text muted on dark purple: #C4B5FD

Border color: rgba(45, 27, 105, 0.15)
Shadow: 0 8px 32px rgba(45, 27, 105, 0.12)

--- Typography ---

Font: Install and use 'Inter' from Google Fonts
Headings: font-weight 700 or 800, color #1A1040
Body: font-weight 400, color #1A1040 or #3D2B7A
Buttons: font-weight 600
All text: letter-spacing normal, line-height 1.6

Font sizes:
  Hero heading: 48px (mobile: 32px)
  Section heading: 32px
  Card heading: 20px
  Body: 16px
  Small/caption: 14px
  Tiny: 12px

--- Buttons ---

Primary button:
  background: #2D1B69
  color: #FFFFFF
  border-radius: 50px (pill shape — exactly like MetaMask)
  padding: 14px 32px
  font-weight: 600
  font-size: 16px
  border: none
  cursor: pointer
  transition: all 0.2s ease
  hover: background #1A0F45, transform translateY(-1px), box-shadow 0 4px 16px rgba(45,27,105,0.3)

Secondary button (outlined):
  background: transparent
  color: #2D1B69
  border: 2px solid #2D1B69
  border-radius: 50px
  padding: 12px 30px
  font-weight: 600
  hover: background #2D1B69, color white

Ghost button (on orange bg):
  background: rgba(255,255,255,0.2)
  color: #1A1040
  border: 2px solid rgba(255,255,255,0.4)
  border-radius: 50px
  hover: background rgba(255,255,255,0.35)

Danger button:
  background: #FF4D4D
  color: white
  border-radius: 50px
  Same padding as primary

--- Cards ---

Standard white card:
  background: #FFFFFF
  border-radius: 20px
  padding: 28px
  box-shadow: 0 8px 32px rgba(45, 27, 105, 0.10)
  border: 1px solid rgba(45, 27, 105, 0.08)

Dark purple card (for featured/highlighted items):
  background: #2D1B69
  border-radius: 20px
  padding: 28px
  color: white

Orange tinted card (subtle):
  background: rgba(255,255,255,0.55)
  backdrop-filter: blur(8px)
  border-radius: 20px
  padding: 24px
  border: 1px solid rgba(255,255,255,0.7)

--- Form Inputs ---

input, select, textarea:
  background: #FFFFFF
  border: 1.5px solid rgba(45, 27, 105, 0.2)
  border-radius: 12px
  padding: 14px 18px
  font-size: 16px
  color: #1A1040
  width: 100%
  transition: border-color 0.2s
  outline: none
  focus: border-color #6B4EFF, box-shadow 0 0 0 3px rgba(107,78,255,0.15)

Label:
  font-size: 14px
  font-weight: 600
  color: #1A1040
  margin-bottom: 6px
  display: block

Input error state:
  border-color: #FF4D4D
  box-shadow: 0 0 0 3px rgba(255,77,77,0.12)

Error message text:
  color: #FF4D4D
  font-size: 13px
  margin-top: 4px

--- Layout ---

Max content width: 1200px, centered with auto margins
Page padding: 0 24px (mobile), 0 48px (desktop)
Section padding: 80px 0 (desktop), 48px 0 (mobile)
Card grid gap: 24px
Navbar height: 72px

--- Navbar ---

background: #FFFFFF
height: 72px
box-shadow: 0 2px 16px rgba(45,27,105,0.08)
Logo: text "LendChain" in dark purple #2D1B69, font-weight 800, font-size 22px
Nav links: #1A1040, font-weight 500, hover color #6B4EFF
Right side: "Connect Wallet" ghost button + "Get Started" primary pill button
Mobile: hamburger menu

--- OTP Input boxes (for email verification) ---

6 individual boxes
Each box: width 52px, height 60px, border-radius 12px
border: 2px solid rgba(45,27,105,0.2)
focus: border-color #6B4EFF, box-shadow 0 0 0 3px rgba(107,78,255,0.15)
background: white
text: font-size 24px, font-weight 700, color #1A1040, text-align center

--- Status badges ---

Active/success: background #E6FFF7, color #00A878, border-radius 50px, padding 4px 12px, font-size 13px, font-weight 600
Pending: background #FFF3E0, color #E65100
At risk: background #FFEBEE, color #C62828
Liquidated: background #F3E5F5, color #6A1B9A

--- Toasts / Alerts ---

Use react-hot-toast positioned top-center
Success: background #1A1040, color white, icon ✓ green
Error: background #FF4D4D, color white
Info: background #6B4EFF, color white

--- Spacing scale ---

4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 80px
Use these values only. No random values.

--- Border radius scale ---

4px (tiny), 8px (small), 12px (inputs), 16px (small cards), 20px (cards), 50px (pills/buttons)

--- Icons ---

Use lucide-react for all icons
Icon size: 18px for inline, 24px for standalone, 32px for feature icons
Icon color: inherit from parent or #6B4EFF for accent icons

--- Loading states ---

Spinner: circular, 24px, border 3px solid rgba(45,27,105,0.15), border-top #6B4EFF, animation spin 0.8s linear infinite
Skeleton: background linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%), background-size 200% 100%, animation shimmer 1.5s infinite
Button loading: show spinner inside button, disable button, reduce opacity to 0.8

--- Page backgrounds ---

Auth pages (login, register, verify): full page background #FF8C69 (orange), centered card white, max-width 440px
Dashboard pages: background #F5F3FF (very light purple-white), sidebar dark purple
Landing/marketing pages: background #FF8C69

--- Animations ---

Page transitions: opacity 0 to 1, 200ms ease
Card hover: transform translateY(-4px), box-shadow increase, 200ms ease
Button hover: translateY(-1px), 150ms ease
All transitions: use ease or ease-out, never linear (except spinners)

=== RULES — NEVER BREAK THESE ===

1. NEVER use plain black (#000000) anywhere
2. NEVER use gray backgrounds — only orange, white, or dark purple
3. ALL buttons must be pill-shaped (border-radius: 50px)
4. ALWAYS use Inter font
5. NEVER use blue as a primary color — purple only
6. ALL cards must have border-radius minimum 16px
7. ALWAYS add hover transitions to interactive elements
8. ALWAYS use the exact hex colors defined above — no approximations
9. Forms always go inside white cards on the orange background
10. The primary call-to-action is always the dark purple pill button

Apply this design system to every single component, page, and element built in this project without exception.. Color Palette (2026 Fintech Style)
The MetaMask screenshot uses a "Peach/Coral" background which feels more human and less "cold" than traditional banking blues.

Primary Background: #FFD8C4 (Soft Peach - warm and inviting for the unbanked).

Primary CTA (Buttons): #000000 (Deep Black - high contrast, looks premium).

Accent Color: #FF5C34 (Persimmon Orange - for "Action" items like "Apply for Loan").

Card/Section Background: #FFFFFF (Pure White - for clarity and trust).
