const assert = require("assert");
const { ALGORITHMS } = require("../static/algorithms.js");

function runGenerator(gen) {
  const events = [];
  for (const event of gen) {
    events.push(event);
  }
  return events;
}

function testRegistry() {
  console.log("Testing ALGORITHMS registry structure...");
  assert(ALGORITHMS, "ALGORITHMS must be defined");
  const expectedKeys = ["bubble", "selection", "insertion", "merge", "quick", "linear", "binary"];
  for (const key of expectedKeys) {
    assert(ALGORITHMS[key], `ALGORITHMS must contain ${key}`);
    assert(typeof ALGORITHMS[key].name === "string", `${key} must have a name`);
    assert(ALGORITHMS[key].kind === "sort" || ALGORITHMS[key].kind === "search", `${key} kind must be sort or search`);
    assert(typeof ALGORITHMS[key].fn === "function", `${key} fn must be a function`);
  }
  assert.strictEqual(ALGORITHMS.binary.needsSorted, true, "binary search must have needsSorted: true");
  console.log("  Registry structure verified.");
}

function testSortingAlgorithms() {
  const sortKeys = ["bubble", "selection", "insertion", "merge", "quick"];

  for (const key of sortKeys) {
    const algo = ALGORITHMS[key];
    console.log(`Testing sort algorithm: ${algo.name} (${key})...`);

    // 1. Empty array
    const emptyArr = [];
    runGenerator(algo.fn(emptyArr));
    assert.deepStrictEqual(emptyArr, [], `${key} failed on empty array`);

    // 2. Single-element array
    const singleArr = [42];
    runGenerator(algo.fn(singleArr));
    assert.deepStrictEqual(singleArr, [42], `${key} failed on single element`);

    // 3. Duplicate elements
    const dupArr = [5, 2, 8, 2, 5, 1, 9, 1, 5, 3];
    const dupExpected = [...dupArr].sort((a, b) => a - b);
    runGenerator(algo.fn(dupArr));
    assert.deepStrictEqual(dupArr, dupExpected, `${key} failed on array with duplicates`);

    // 4. Already sorted array
    const sortedArr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const sortedExpected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    runGenerator(algo.fn(sortedArr));
    assert.deepStrictEqual(sortedArr, sortedExpected, `${key} failed on already sorted array`);

    // 5. Reversed array
    const revArr = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const revExpected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    runGenerator(algo.fn(revArr));
    assert.deepStrictEqual(revArr, revExpected, `${key} failed on reversed array`);

    // 6. 200+ random arrays
    const RANDOM_RUNS = 250;
    for (let r = 0; r < RANDOM_RUNS; r++) {
      const len = Math.floor(Math.random() * 80) + 2; // length 2 to 81
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(Math.floor(Math.random() * 1000) - 500);
      }
      const expected = [...arr].sort((a, b) => a - b);
      const events = runGenerator(algo.fn(arr));

      assert.deepStrictEqual(arr, expected, `${key} failed on random run ${r} (len=${len})`);

      // Verify that events have expected structure
      for (const ev of events) {
        assert(ev.t === "cmp" || ev.t === "write", `Unexpected event type ${ev.t} in ${key}`);
        assert(Array.isArray(ev.k), `Event key must be an array in ${key}`);
      }
    }
    console.log(`  ${algo.name}: passed empty, single, duplicate, sorted, reversed, and ${RANDOM_RUNS} random arrays.`);
  }
}

function testSearchAlgorithms() {
  const searchKeys = ["linear", "binary"];

  for (const key of searchKeys) {
    const algo = ALGORITHMS[key];
    console.log(`Testing search algorithm: ${algo.name} (${key})...`);

    // 1. Empty array
    const emptyArr = [];
    const emptyArrCopy = [...emptyArr];
    const emptyEvents = runGenerator(algo.fn(emptyArr, 42));
    assert.strictEqual(emptyEvents.length > 0, true, "Empty search should yield events");
    assert.strictEqual(emptyEvents[emptyEvents.length - 1].t, "miss", "Empty search should yield miss");
    assert.deepStrictEqual(emptyArr, emptyArrCopy, "Search must not change empty array");

    // 2. Single-element array - found
    const singleArr = [42];
    const singleEventsFound = runGenerator(algo.fn(singleArr, 42));
    assert.deepStrictEqual(singleArr, [42], "Search must not change array");
    const lastEvent1 = singleEventsFound[singleEventsFound.length - 1];
    assert.strictEqual(lastEvent1.t, "found");
    assert.strictEqual(lastEvent1.i, 0);

    // 2b. Single-element array - miss
    const singleEventsMiss = runGenerator(algo.fn(singleArr, 99));
    assert.deepStrictEqual(singleArr, [42], "Search must not change array");
    const lastEvent2 = singleEventsMiss[singleEventsMiss.length - 1];
    assert.strictEqual(lastEvent2.t, "miss");

    // 3. Duplicates in sorted array
    const dupSorted = [1, 3, 3, 3, 7, 9, 12];
    const dupCopy = [...dupSorted];
    const dupEvents = runGenerator(algo.fn(dupSorted, 3));
    assert.deepStrictEqual(dupSorted, dupCopy, "Search must not change array");
    const lastDupEvent = dupEvents[dupEvents.length - 1];
    assert.strictEqual(lastDupEvent.t, "found");
    assert.strictEqual(dupSorted[lastDupEvent.i], 3);

    // 4. 200+ random search trials
    const RANDOM_RUNS = 250;
    for (let r = 0; r < RANDOM_RUNS; r++) {
      const len = Math.floor(Math.random() * 60) + 1; // 1 to 60 elements
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(Math.floor(Math.random() * 200));
      }
      arr.sort((a, b) => a - b);
      const arrCopy = [...arr];

      // 50% chance pick existing element, 50% pick random target
      const target = Math.random() < 0.5
        ? arr[Math.floor(Math.random() * arr.length)]
        : Math.floor(Math.random() * 300) - 50;

      const shouldFind = arr.includes(target);
      const events = runGenerator(algo.fn(arr, target));

      // Must not change array
      assert.deepStrictEqual(arr, arrCopy, `${key} modified array on run ${r}`);

      const lastEv = events[events.length - 1];
      assert(lastEv, `${key} yielded no events`);

      if (shouldFind) {
        assert.strictEqual(lastEv.t, "found", `${key} should have found target ${target} in ${JSON.stringify(arr)}`);
        assert.strictEqual(arr[lastEv.i], target, `${key} found incorrect index ${lastEv.i} for ${target}`);
      } else {
        assert.strictEqual(lastEv.t, "miss", `${key} should have reported miss for ${target}`);
      }

      // Check event types
      if (key === "binary") {
        for (const ev of events) {
          assert(["range", "cmp", "found", "miss"].includes(ev.t), `Unexpected binary event ${ev.t}`);
        }
      } else if (key === "linear") {
        for (const ev of events) {
          assert(["cmp", "found", "miss"].includes(ev.t), `Unexpected linear event ${ev.t}`);
        }
      }
    }
    console.log(`  ${algo.name}: passed empty, single, duplicate, sorted, and ${RANDOM_RUNS} random searches.`);
  }
}

function main() {
  console.log("=== RUNNING ALGORITHM TESTS ===");
  testRegistry();
  testSortingAlgorithms();
  testSearchAlgorithms();
  console.log("=== ALL ALGORITHM TESTS PASSED SUCCESSFULLY! ===");
}

main();
