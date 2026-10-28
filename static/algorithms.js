/**
 * Algorithm Visualizer - Algorithm Implementations
 * Each algorithm is a JavaScript generator that changes the array in place
 * and yields one event per step.
 */

function* bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      yield { t: "cmp", k: [j, j + 1] };
      if (arr[j] > arr[j + 1]) {
        const tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;
        swapped = true;
        yield { t: "write", k: [j, j + 1] };
      }
    }
    if (!swapped) {
      break;
    }
  }
}

function* selectionSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      yield { t: "cmp", k: [j, minIdx] };
      if (arr[j] < arr[minIdx]) {
        minIdx = j;
      }
    }
    if (minIdx !== i) {
      const tmp = arr[i];
      arr[i] = arr[minIdx];
      arr[minIdx] = tmp;
      yield { t: "write", k: [i, minIdx] };
    }
  }
}

function* insertionSort(arr) {
  const n = arr.length;
  for (let i = 1; i < n; i++) {
    let j = i;
    while (j > 0) {
      yield { t: "cmp", k: [j - 1, j] };
      if (arr[j - 1] > arr[j]) {
        const tmp = arr[j - 1];
        arr[j - 1] = arr[j];
        arr[j] = tmp;
        yield { t: "write", k: [j - 1, j] };
        j--;
      } else {
        break;
      }
    }
  }
}

function* mergeSort(arr) {
  if (arr.length <= 1) return;
  yield* mergeSortHelper(arr, 0, arr.length - 1);
}

function* mergeSortHelper(arr, left, right) {
  if (left >= right) return;
  const mid = Math.floor((left + right) / 2);
  yield* mergeSortHelper(arr, left, mid);
  yield* mergeSortHelper(arr, mid + 1, right);
  yield* merge(arr, left, mid, right);
}

function* merge(arr, left, mid, right) {
  const temp = [];
  for (let idx = left; idx <= right; idx++) {
    temp.push(arr[idx]);
  }
  let i = 0;
  const leftEnd = mid - left;
  let j = mid - left + 1;
  const rightEnd = right - left;
  let k = left;

  while (i <= leftEnd && j <= rightEnd) {
    yield { t: "cmp", k: [left + i, left + j] };
    if (temp[i] <= temp[j]) {
      arr[k] = temp[i];
      yield { t: "write", k: [k] };
      i++;
    } else {
      arr[k] = temp[j];
      yield { t: "write", k: [k] };
      j++;
    }
    k++;
  }

  while (i <= leftEnd) {
    arr[k] = temp[i];
    yield { t: "write", k: [k] };
    i++;
    k++;
  }

  while (j <= rightEnd) {
    arr[k] = temp[j];
    yield { t: "write", k: [k] };
    j++;
    k++;
  }
}

function* quickSort(arr) {
  if (arr.length <= 1) return;
  yield* quickSortHelper(arr, 0, arr.length - 1);
}

function* quickSortHelper(arr, low, high) {
  if (low < high) {
    const pivotIdx = yield* lomutoPartition(arr, low, high);
    yield* quickSortHelper(arr, low, pivotIdx - 1);
    yield* quickSortHelper(arr, pivotIdx + 1, high);
  }
}

function* lomutoPartition(arr, low, high) {
  const pivot = arr[high];
  let i = low - 1;
  for (let j = low; j < high; j++) {
    yield { t: "cmp", k: [j, high] };
    if (arr[j] <= pivot) {
      i++;
      if (i !== j) {
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
        yield { t: "write", k: [i, j] };
      }
    }
  }
  if (i + 1 !== high) {
    const tmp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = tmp;
    yield { t: "write", k: [i + 1, high] };
  }
  return i + 1;
}

function* linearSearch(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    yield { t: "cmp", k: [i] };
    if (arr[i] === target) {
      yield { t: "found", i };
      return;
    }
  }
  yield { t: "miss" };
}

function* binarySearch(arr, target) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    yield { t: "range", lo, hi };
    const mid = Math.floor((lo + hi) / 2);
    yield { t: "cmp", k: [mid] };
    if (arr[mid] === target) {
      yield { t: "found", i: mid };
      return;
    } else if (arr[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  yield { t: "miss" };
}

const ALGORITHMS = {
  bubble: {
    id: "bubble",
    name: "Bubble Sort",
    kind: "sort",
    fn: bubbleSort,
  },
  selection: {
    id: "selection",
    name: "Selection Sort",
    kind: "sort",
    fn: selectionSort,
  },
  insertion: {
    id: "insertion",
    name: "Insertion Sort",
    kind: "sort",
    fn: insertionSort,
  },
  merge: {
    id: "merge",
    name: "Merge Sort",
    kind: "sort",
    fn: mergeSort,
  },
  quick: {
    id: "quick",
    name: "Quick Sort",
    kind: "sort",
    fn: quickSort,
  },
  linear: {
    id: "linear",
    name: "Linear Search",
    kind: "search",
    fn: linearSearch,
  },
  binary: {
    id: "binary",
    name: "Binary Search",
    kind: "search",
    fn: binarySearch,
    needsSorted: true,
  },
};

if (typeof window !== "undefined") {
  window.ALGORITHMS = ALGORITHMS;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ALGORITHMS };
}
