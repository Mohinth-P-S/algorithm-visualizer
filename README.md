# Algorithm Visualizer

A full-stack, dependency-free web application that animates sorting and searching algorithms step-by-step and records a persistent history of runs with aggregate analytics.

Built entirely with the **Python 3 standard library** on the backend and **vanilla HTML, CSS, and JavaScript** on the frontend. No third-party packages, no frameworks, no build tools, and no external CDN links.

---

## Features

- **Interactive Animations**: Visualize how algorithms operate step-by-step with color-coded states:
  - Blue (`#3b5b8c`): Normal array element
  - Orange (`#f2a900`): Comparing elements
  - Red (`#e4572e`): Changed / swapped positions
  - Teal (`#1b998b`): Sorted array or search target found
  - Dimmed: Elements outside the current active search range in Binary Search
- **Supported Algorithms**:
  - **Sorting**: Bubble Sort (with early exit), Selection Sort, Insertion Sort (adjacent swaps), Merge Sort (top-down), Quick Sort (Lomuto partition, last element as pivot).
  - **Searching**: Linear Search, Binary Search (with search range tracking).
- **Smart Execution**:
  - Automatically shuffles an array before sorting if it is already sorted.
  - Automatically sorts the array before executing Binary Search and notifies the user.
  - Search value validator ensures whole numbers between 1 and 100 with friendly feedback.
- **Real-Time Metrics**: Live counters for comparisons and array writes (`writes = total indexes in write events`).
- **Graph-Paper Background & Numbers**: Clean graph-paper canvas that displays values on bars when the array size is 40 or fewer elements.
- **Run History & Analytics**:
  - Automatically posts run results to SQLite (`runs.db`).
  - Displays "Latest runs" (newest 10 runs with local timestamp) and "Averages by algorithm".
  - "Clear history" button with confirmation dialog.
- **Responsive & Accessible**: Fully usable on mobile devices, with visible keyboard focus styling (`:focus-visible`) and ARIA labels.

---

## Project Layout

```
algorithm-visualizer/
├── server.py               # ThreadingHTTPServer, SQLite database, REST API, static file server
├── static/
│   ├── index.html          # Semantic HTML5 layout, controls, visualizer container, tables
│   ├── style.css           # Graph-paper background, responsive layout, bar styling, color themes
│   ├── algorithms.js       # Generator functions for all 7 algorithms and ALGORITHMS registry
│   └── app.js              # UI controller, animation loop, DOM rendering, API communication
├── tests/
│   ├── test_server.py      # Python unittest suite (real server on random port, temp SQLite DB)
│   └── test_algorithms.js  # Node.js assert suite (edge cases, empty, single, 250+ random arrays)
├── README.md               # Documentation and usage guide
└── .gitignore              # Ignores runs.db, __pycache__/, *.pyc
```

---

## Quick Start

### 1. Start the Server

From the `algorithm-visualizer/` folder, run:

```bash
python server.py
```

The server binds to `127.0.0.1:8000` by default. You can also specify a custom port as a command-line argument or via the `PORT` environment variable:

```bash
python server.py 8080
# or
PORT=8080 python server.py
```

On first launch, SQLite database `runs.db` is automatically created if it does not already exist.

### 2. Open in Browser

Open your web browser and navigate to:

```
http://localhost:8000
```

---

## How to Use

1. **Select an Algorithm**: Choose from the dropdown menu (grouped into Sorting and Searching).
2. **Configure Parameters**:
   - **Array Size Slider**: Adjust size from 5 to 100 (default: 30).
   - **Speed Slider**: Control animation delay from slow to fast in real time.
   - **Value to find** (for searches): Enter an integer from 1 to 100 (automatically pre-filled with an existing value from the array).
3. **Control Execution**:
   - **New Array**: Generates a new randomized array.
   - **Start**: Begins execution. Disables Start, Algorithm selection, and Size slider during the run.
   - **Stop**: Cleanly halts the run at any point and restores controls.
4. **Inspect Results**:
   - Review live metrics during execution.
   - When a run finishes, a summary message appears, the run is saved to `/api/runs`, and the history tables refresh.
   - Use **Clear history** to purge recorded runs (prompts for confirmation).

---

## REST API Specification

All API endpoints return and accept JSON. Unknown `/api` paths return status `404` with `{"error": "Not found"}`.

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/` | Serves `static/index.html` (prevents path traversal) | 200, 404 |
| `GET` | `/<file>` | Serves static assets (`style.css`, `algorithms.js`, etc.) | 200, 404 |
| `GET` | `/api/runs` | Returns the latest 10 runs as a JSON array, newest first | 200, 500 |
| `POST` | `/api/runs` | Saves a new run and returns the created row object | 201, 400, 500 |
| `GET` | `/api/stats` | Returns aggregated metrics per algorithm (rounded to 1 decimal) | 200, 500 |
| `DELETE` | `/api/runs` | Deletes all recorded runs and returns `{"deleted": count}` | 200, 500 |

### `POST /api/runs` Validation Rules

- **Content-Length / Body Size**: Max 1000 bytes.
- **Payload Format**: Must be a valid JSON object.
- **Fields**:
  - `algorithm` *(string)*: Must be one of `bubble`, `selection`, `insertion`, `merge`, `quick`, `linear`, `binary`.
  - `size` *(int)*: Whole number between `2` and `200`. Booleans, strings, and floats are rejected.
  - `comparisons` *(int)*: Whole number between `0` and `10,000,000`. Booleans, strings, and floats are rejected.
  - `writes` *(int)*: Whole number between `0` and `10,000,000`. Booleans, strings, and floats are rejected.
- **Error Response**: Any validation failure returns status `400` with `{"error": "<message>"}`.

---

## Running the Tests

The project includes test suites for both the Python server and the JavaScript algorithm generators.

### 1. Run Server Unit Tests (Python)

Starts a real `ThreadingHTTPServer` on an ephemeral port with an isolated temporary SQLite database, verifying static file serving, traversal defense, run limits, all validation edge cases, statistics rounding, and deletion:

```bash
python tests/test_server.py
```

### 2. Run Algorithm Tests (Node.js)

Tests every sorting algorithm against empty, single-element, duplicate, sorted, reversed, and 250+ randomized arrays. Verifies search algorithms for correct indices, misses, and ensures search operations never mutate arrays:

```bash
node tests/test_algorithms.js
```
