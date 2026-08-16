# Spin the Wheel

A customizable, pastel spin wheel for choosing content hooks, reel formats, creative prompts, or anything else that benefits from a little randomness.

**Live site:** [rshukla2.github.io/Spin-the-Wheel](https://rshukla2.github.io/Spin-the-Wheel/)

> Screenshot coming soon after the first GitHub Pages deployment.

## What it can do

- Turn every non-empty line into a wheel entry
- Create and switch between multiple named wheels
- Shuffle, sort, duplicate, reorder, weight, recolor, or delete entries
- Customize the seven-color pastel palette, spin duration, label size, casino-style sound, volume, and confetti
- Keep a timestamped history of winning entries
- Optionally remove winners automatically for no-repeat rounds
- Queue a one-shot winner with the private **Rigged Wheel** setting
- Save the full workspace in the browser between sessions
- Back up or restore all wheels with JSON
- Import or export the current wheel as CSV
- Work responsively on desktop, tablet, and mobile
- Respect reduced-motion preferences and support keyboard spinning

## Using the app

1. Open the **Entries** tab.
2. Put one option on each line. Blank lines are ignored.
3. Select **Advanced** to change weights, colors, order, or individual entries.
4. Press the center **Spin** button, or press <kbd>Space</kbd> while focus is outside a form control.
5. The winning wedge lifts, gains a dark outline, and remains highlighted until the next spin. Previous winners appear in **Results**.

Use **Settings** to rename the wheel, edit its pastel palette, change animation and label behavior, turn the Vegas-style ratchet and winner fanfare or confetti on and off, duplicate the wheel, or delete it. **Rigged Wheel** can privately queue one entry to win the next spin; the choice clears when that spin starts and returns to the normal weight-aware random selection. The final remaining wheel cannot be deleted.

## Browser saving and privacy

The app has no backend, accounts, analytics, or database. Its versioned workspace is saved to `localStorage` in the current browser, so it survives closing and reopening the browser on the same device.

Pending one-shot Rigged Wheel choices are part of that local workspace and remain private to the browser unless the workspace is explicitly exported as JSON.

- Clearing this site's browser data also clears the locally saved workspace.
- Browser data does not automatically follow you to another device or browser profile.
- Use **Backup** to download a JSON copy before clearing data or changing devices.
- Importing a JSON backup can either add its wheels to the current workspace or replace the workspace.

## CSV format

CSV imports and exports use these columns:

```csv
label,weight,color
Story hook,2,#A8BFA3
Tutorial hook,1,
```

`weight` is an integer from 1–10. `color` is optional and uses a six-digit hex value. Importing CSV creates a new wheel rather than overwriting the active one.

## Local development

Requirements: [Node.js](https://nodejs.org/) 22 or newer and npm.

```bash
npm install
npm run dev
```

Vite prints the local development URL in the terminal. Other useful commands:

```bash
npm test          # Vitest unit and component tests
npm run test:e2e  # Playwright desktop and mobile flows
npm run build     # Type-check and create the production site
npm run preview   # Preview the production build
```

The production base path is `/Spin-the-Wheel/`, matching this repository's GitHub Pages URL.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` tests and builds every push and deploys pushes to `main` using GitHub's official Pages actions.

For the initial setup:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push to `main`, then follow the run under the **Actions** tab.

Pull requests run tests and build checks without deploying. The site is published at `https://rshukla2.github.io/Spin-the-Wheel/` after a successful deployment.

## Project structure

```text
src/
  components/WheelView.tsx  SVG wheel and pointer
  lib/workspace.ts          State, persistence, selection, JSON/CSV helpers
  App.tsx                   Main interface and interactions
  styles.css                Pastel responsive design system
e2e/                        Playwright user flows
.github/workflows/          GitHub Pages automation
```

## Accessibility

The interface uses real form controls, visible keyboard focus, a screen-reader result announcement, dark text over the pastel wedges, an accessible SVG description, and reduced-motion fallbacks. The default wedge colors all have at least a 7:1 contrast ratio with the charcoal label color.

## License

No license has been added. Copyright remains with the repository owner unless a license is added later.
