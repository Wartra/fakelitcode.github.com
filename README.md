# Verdict Judge

A LeetCode-style practice site: 18 classic problems, a JavaScript editor, and Run/Submit judged entirely in the browser. Plain HTML, CSS and JavaScript, with no build step and no backend.

## Run it

Serve the folder with any static server, then open http://localhost:8000:

```bash
python3 -m http.server 8000
```

Opening `index.html` directly from disk also mostly works, but some browsers block the Web Workers the judge uses on `file://` pages, so a server is the reliable route.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page markup: top bar, problem list, workspace |
| `css/style.css` | All styles, with light and dark themes via `prefers-color-scheme` |
| `js/runtime.js` | DOM helpers, localStorage wrapper, the judge (runs code in a Web Worker with a 2 s per-test limit), seeded random test generators |
| `js/problems.js` | The problem set: statement, examples, constraints, reference solution, hidden-test generator and editorial for each problem |
| `js/app.js` | The UI: list and filters, editor, testcase console, Run/Submit, submissions, routing (`#two-sum` opens a problem) |

## Adding a problem

Add an object to `PROBLEMS` in `js/problems.js`. The required fields are `slug`, `title`, `diff`, `tags`, `fn`, `params`, `ret`, `desc`, `examples`, `constraints`, `gen`, `ref` and `ed`. Expected outputs come from running `ref`, so you never write them by hand. Use `check` for problems with more than one correct answer, and `float: true` for answers compared within 1e-5.

Progress, drafts and submissions are stored in each visitor's browser (localStorage).
