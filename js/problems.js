'use strict';
// The problem set. Each problem has a statement, examples, a reference solution and a hidden-test generator.

/* ================= problem set ================= */
const PROBLEMS = [
{
  slug: 'two-sum', title: 'Two Sum', diff: 'Easy', tags: ['Array', 'Hash Table'],
  fn: 'twoSum', params: [['nums', 'number[]'], ['target', 'number']], ret: 'number[]', anyAnswer: true,
  desc: `<p>You are given an integer array <code>nums</code> and an integer <code>target</code>. Return the indices of two <em>different</em> elements whose values add up to <code>target</code>.</p><p>Every input has at least one valid pair. If several pairs work, any of them is accepted, and the two indices can come in either order.</p>`,
  examples: [
    { args: [[2, 7, 11, 15], 9], note: '<code>nums[0] + nums[1] = 2 + 7 = 9</code>, so <code>[0,1]</code> is an answer.' },
    { args: [[3, 2, 4], 6] },
    { args: [[3, 3], 6] },
  ],
  constraints: ['2 ≤ nums.length ≤ 10<sup>4</sup>', '-10<sup>9</sup> ≤ nums[i] ≤ 10<sup>9</sup>', '-10<sup>9</sup> ≤ target ≤ 10<sup>9</sup>', 'At least one valid pair exists.'],
  followup: 'Can you do better than O(n<sup>2</sup>) time?',
  check([nums, target], out) {
    if (!Array.isArray(out) || out.length !== 2) return false;
    const [i, j] = out;
    return Number.isInteger(i) && Number.isInteger(j) && i !== j && i >= 0 && j >= 0 && i < nums.length && j < nums.length && nums[i] + nums[j] === target;
  },
  gen(R, i) {
    const big = i >= 28, n = big ? R.int(2000, 10000) : R.int(2, 30), lim = big ? 5e8 : 50;
    const nums = R.arr(n, -lim, lim);
    const a = R.int(0, n - 1); let b = R.int(0, n - 2); if (b >= a) b++;
    return [nums, nums[a] + nums[b]];
  },
  ref: `var twoSum = function(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        if (seen.has(need)) return [seen.get(need), i];
        seen.set(nums[i], i);
    }
    return [];
};`,
  ed: { approach: `<p>Walk the array once and remember every value you have seen in a hash map, value → index. For each <code>nums[i]</code> the partner it needs is <code>target − nums[i]</code>; if that partner is already in the map, you have your pair.</p><p>Checking every pair also works, but costs O(n²).</p>`, time: 'O(n)', space: 'O(n)' },
},
{
  slug: 'valid-parentheses', title: 'Valid Parentheses', diff: 'Easy', tags: ['String', 'Stack'],
  fn: 'isValid', params: [['s', 'string']], ret: 'boolean',
  desc: `<p>The string <code>s</code> contains only the characters <code>(</code> <code>)</code> <code>[</code> <code>]</code> <code>{</code> <code>}</code>. Decide whether it is <strong>valid</strong>:</p><ul><li>every opening bracket is closed by a bracket of the same kind;</li><li>brackets close in the reverse order they were opened;</li><li>every closing bracket has a matching opening bracket before it.</li></ul>`,
  examples: [{ args: ['()'] }, { args: ['()[]{}'] }, { args: ['(]'] }, { args: ['([)]'], note: 'The <code>[</code> is still open when <code>)</code> arrives.' }],
  constraints: ['1 ≤ s.length ≤ 10<sup>4</sup>', 's contains only <code>()[]{}</code>'],
  gen(R, i) {
    const big = i >= 28;
    if (R.chance(0.3)) return [R.str(R.int(1, big ? 10000 : 10), '()[]{}')];
    let s = balanced(R, R.int(1, big ? 4999 : 5));
    if (R.chance(0.4)) { const k = R.int(0, s.length - 1); s = s.slice(0, k) + R.pick('()[]{}') + s.slice(k + 1); }
    return [s];
  },
  ref: `var isValid = function(s) {
    const pairs = { ')': '(', ']': '[', '}': '{' };
    const stack = [];
    for (const ch of s) {
        if (ch in pairs) {
            if (stack.pop() !== pairs[ch]) return false;
        } else {
            stack.push(ch);
        }
    }
    return stack.length === 0;
};`,
  ed: { approach: `<p>Push each opening bracket onto a stack. A closing bracket must match the bracket on top of the stack: pop it if it does, fail if it doesn't or the stack is empty. The string is valid when the stack ends empty.</p>`, time: 'O(n)', space: 'O(n)' },
},
{
  slug: 'merge-two-sorted-lists', title: 'Merge Two Sorted Lists', diff: 'Easy', tags: ['Linked List', 'Recursion'],
  fn: 'mergeTwoLists', params: [['list1', 'ListNode'], ['list2', 'ListNode']], ret: 'ListNode',
  desc: `<p>You get the heads of two linked lists, <code>list1</code> and <code>list2</code>, each sorted in non-decreasing order. Splice their nodes together into one sorted list and return its head.</p><p>Lists are written as arrays: <code>[1,2,4]</code> is the list 1 → 2 → 4.</p>`,
  examples: [{ args: [[1, 2, 4], [1, 3, 4]] }, { args: [[], []] }, { args: [[], [0]] }],
  constraints: ['Each list has 0 to 50 nodes', '-100 ≤ Node.val ≤ 100', 'Both lists are sorted in non-decreasing order'],
  gen(R, i) { const len = i < 12 ? 4 : 50; const srt = () => R.arr(R.int(0, len), -100, 100).sort((a, b) => a - b); return [srt(), srt()]; },
  ref: `var mergeTwoLists = function(list1, list2) {
    const dummy = new ListNode();
    let tail = dummy;
    while (list1 && list2) {
        if (list1.val <= list2.val) { tail.next = list1; list1 = list1.next; }
        else { tail.next = list2; list2 = list2.next; }
        tail = tail.next;
    }
    tail.next = list1 || list2;
    return dummy.next;
};`,
  ed: { approach: `<p>Keep a dummy head and a tail pointer. Repeatedly attach the smaller of the two current nodes to the tail and advance that list. When one list runs out, attach whatever remains of the other.</p>`, time: 'O(m + n)', space: 'O(1)' },
},
{
  slug: 'best-time-to-buy-and-sell-stock', title: 'Best Time to Buy and Sell Stock', diff: 'Easy', tags: ['Array', 'Greedy'],
  fn: 'maxProfit', params: [['prices', 'number[]']], ret: 'number',
  desc: `<p><code>prices[i]</code> is a stock's price on day <code>i</code>. You may buy one share on some day and sell it on a <em>later</em> day. Return the largest profit you can make, or <code>0</code> if no trade makes money.</p>`,
  examples: [{ args: [[7, 1, 5, 3, 6, 4]], note: 'Buy on day 1 at 1, sell on day 4 at 6: profit 6 − 1 = 5. Buying at 1 and "selling" at 7 on day 0 is not allowed, since you must sell after you buy.' }, { args: [[7, 6, 4, 3, 1]], note: 'Prices only fall, so the best move is not to trade.' }],
  constraints: ['1 ≤ prices.length ≤ 10<sup>5</sup>', '0 ≤ prices[i] ≤ 10<sup>4</sup>'],
  gen(R, i) { const big = i >= 28; const p = R.arr(big ? R.int(50000, 100000) : R.int(1, 15), 0, big ? 10000 : 20); if (i % 10 === 3) p.sort((a, b) => b - a); return [p]; },
  ref: `var maxProfit = function(prices) {
    let cheapest = Infinity, best = 0;
    for (const p of prices) {
        cheapest = Math.min(cheapest, p);
        best = Math.max(best, p - cheapest);
    }
    return best;
};`,
  ed: { approach: `<p>Scan left to right while tracking the cheapest price seen so far. Selling today would earn <code>price − cheapest</code>; keep the best of those. Comparing every pair of days is O(n²) and times out on the 10<sup>5</sup>-day tests.</p>`, time: 'O(n)', space: 'O(1)' },
},
{
  slug: 'climbing-stairs', title: 'Climbing Stairs', diff: 'Easy', tags: ['Dynamic Programming', 'Math'],
  fn: 'climbStairs', params: [['n', 'number']], ret: 'number', count: 45,
  desc: `<p>A staircase has <code>n</code> steps. Each move climbs either 1 or 2 steps. In how many distinct ways can you reach the top?</p>`,
  examples: [{ args: [2], note: '1 + 1, or 2.' }, { args: [3], note: '1 + 1 + 1, 1 + 2, or 2 + 1.' }],
  constraints: ['1 ≤ n ≤ 45'],
  gen(R, i) { return [i + 1]; },
  ref: `var climbStairs = function(n) {
    let a = 1, b = 1;
    for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
    return b;
};`,
  ed: { approach: `<p>To land on step <code>n</code>, the last move came from step <code>n − 1</code> or <code>n − 2</code>, so <code>ways(n) = ways(n − 1) + ways(n − 2)</code>: the Fibonacci numbers. Keep only the last two values.</p><p>Plain recursion without memoisation repeats work exponentially and times out at <code>n = 45</code>.</p>`, time: 'O(n)', space: 'O(1)' },
},
{
  slug: 'reverse-linked-list', title: 'Reverse Linked List', diff: 'Easy', tags: ['Linked List', 'Recursion'],
  fn: 'reverseList', params: [['head', 'ListNode']], ret: 'ListNode',
  desc: `<p>Given the <code>head</code> of a singly linked list, reverse the list and return the new head.</p>`,
  examples: [{ args: [[1, 2, 3, 4, 5]] }, { args: [[1, 2]] }, { args: [[]] }],
  constraints: ['The list has 0 to 5000 nodes', '-5000 ≤ Node.val ≤ 5000'],
  followup: 'Solve it both iteratively and recursively.',
  gen(R, i) { return [R.arr(R.int(0, i >= 28 ? 5000 : 8), -5000, 5000)]; },
  ref: `var reverseList = function(head) {
    let prev = null, cur = head;
    while (cur) {
        const next = cur.next;
        cur.next = prev;
        prev = cur;
        cur = next;
    }
    return prev;
};`,
  ed: { approach: `<p>Walk the list with three pointers, <code>prev</code>, <code>cur</code> and <code>next</code>, and point each node back at the one before it. When <code>cur</code> falls off the end, <code>prev</code> is the new head.</p>`, time: 'O(n)', space: 'O(1)' },
},
{
  slug: 'maximum-depth-of-binary-tree', title: 'Maximum Depth of Binary Tree', diff: 'Easy', tags: ['Tree', 'Breadth-First Search'],
  fn: 'maxDepth', params: [['root', 'TreeNode']], ret: 'number',
  desc: `<p>Return the maximum depth of the binary tree rooted at <code>root</code>: the number of nodes on the longest path from the root down to a leaf.</p><p>Trees are written in level order, with <code>null</code> marking a missing child.</p>`,
  examples: [{ args: [[3, 9, 20, null, null, 15, 7]], note: 'The longest paths are 3 → 20 → 15 and 3 → 20 → 7.' }, { args: [[1, null, 2]] }],
  constraints: ['The tree has 0 to 10<sup>4</sup> nodes', '-100 ≤ Node.val ≤ 100'],
  gen(R, i) {
    if (i < 25) return [randTree(R, R.int(0, 15))];
    if (i % 3 === 0) return [randTree(R, R.int(1000, 3000), true)];
    return [randTree(R, R.int(2000, 10000))];
  },
  ref: `var maxDepth = function(root) {
    if (!root) return 0;
    let depth = 0, level = [root];
    while (level.length) {
        depth++;
        const next = [];
        for (const node of level) {
            if (node.left) next.push(node.left);
            if (node.right) next.push(node.right);
        }
        level = next;
    }
    return depth;
};`,
  ed: { approach: `<p>Breadth-first search: process the tree one level at a time and count the levels. The recursive version, <code>1 + max(depth(left), depth(right))</code>, is shorter but uses stack space proportional to the tree's height.</p>`, time: 'O(n)', space: 'O(width)' },
},
{
  slug: 'binary-search', title: 'Binary Search', diff: 'Easy', tags: ['Array', 'Binary Search'],
  fn: 'search', params: [['nums', 'number[]'], ['target', 'number']], ret: 'number',
  desc: `<p><code>nums</code> holds distinct integers sorted in ascending order. Return the index of <code>target</code> in <code>nums</code>, or <code>-1</code> if it is not there.</p>`,
  examples: [{ args: [[-1, 0, 3, 5, 9, 12], 9], note: '9 sits at index 4.' }, { args: [[-1, 0, 3, 5, 9, 12], 2], note: '2 is not in the array.' }],
  constraints: ['1 ≤ nums.length ≤ 10<sup>4</sup>', '-10<sup>4</sup> &lt; nums[i], target &lt; 10<sup>4</sup>', 'All values in nums are distinct', 'nums is sorted ascending'],
  followup: 'Aim for O(log n) time.',
  gen(R, i) {
    const big = i >= 28;
    const nums = R.distinct(big ? R.int(5000, 10000) : R.int(1, 12), -9999, 9999).sort((a, b) => a - b);
    return [nums, R.chance(0.5) ? R.pick(nums) : R.int(-9999, 9999)];
  },
  ref: `var search = function(nums, target) {
    let lo = 0, hi = nums.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
};`,
  ed: { approach: `<p>Keep a window <code>[lo, hi]</code> that must contain the target if it exists. Compare the middle element with the target and discard the half that can't hold it. The window halves every step.</p>`, time: 'O(log n)', space: 'O(1)' },
},
{
  slug: 'longest-substring-without-repeating-characters', title: 'Longest Substring Without Repeating Characters', diff: 'Medium', tags: ['String', 'Sliding Window', 'Hash Table'],
  fn: 'lengthOfLongestSubstring', params: [['s', 'string']], ret: 'number',
  desc: `<p>Find the length of the longest <strong>substring</strong> of <code>s</code> in which no character appears twice. A substring is a contiguous run of characters.</p>`,
  examples: [{ args: ['abcabcbb'], note: 'The answer is "abc".' }, { args: ['bbbbb'], note: 'The answer is "b".' }, { args: ['pwwkew'], note: '"wke" has length 3. "pwke" is a subsequence, not a substring.' }],
  constraints: ['0 ≤ s.length ≤ 5 · 10<sup>4</sup>', 's contains English letters, digits, symbols and spaces'],
  gen(R, i) { return [R.str(i >= 28 ? R.int(10000, 50000) : R.int(0, 16), R.pick(['ab', 'abc', 'abcdefghij', LOWER, ASCII]))]; },
  ref: `var lengthOfLongestSubstring = function(s) {
    const last = new Map();
    let start = 0, best = 0;
    for (let i = 0; i < s.length; i++) {
        const seen = last.get(s[i]);
        if (seen !== undefined && seen >= start) start = seen + 1;
        last.set(s[i], i);
        best = Math.max(best, i - start + 1);
    }
    return best;
};`,
  ed: { approach: `<p>Slide a window over the string while remembering the last index of each character. When the incoming character already appears inside the window, move the window's left edge to just past that earlier occurrence. The answer is the widest window seen.</p>`, time: 'O(n)', space: 'O(alphabet)' },
},
{
  slug: 'group-anagrams', title: 'Group Anagrams', diff: 'Medium', tags: ['Array', 'Hash Table', 'String', 'Sorting'],
  fn: 'groupAnagrams', params: [['strs', 'string[]']], ret: 'string[][]', anyAnswer: true,
  desc: `<p>Group the strings in <code>strs</code> so that each group holds words that are anagrams of one another: the same letters, rearranged. Groups, and the words inside each group, may come in any order.</p>`,
  examples: [{ args: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']] }, { args: [['']] }, { args: [['a']] }],
  constraints: ['1 ≤ strs.length ≤ 10<sup>4</sup>', '0 ≤ strs[i].length ≤ 100', 'strs[i] contains lowercase English letters'],
  check(args, out, exp) {
    if (!Array.isArray(out) || !out.every(Array.isArray)) return false;
    const norm = gs => gs.map(g => JSON.stringify([...g].sort())).sort().join('|');
    return norm(out) === norm(exp);
  },
  gen(R, i) {
    const big = i >= 28, al = LOWER.slice(0, R.int(2, 26));
    const bases = Array.from({ length: R.int(1, big ? 400 : 4) }, () => R.str(R.int(0, big ? 12 : 4), al));
    return [Array.from({ length: big ? R.int(2000, 10000) : R.int(1, 8) }, () => R.shuffle(R.pick(bases).split('')).join(''))];
  },
  ref: `var groupAnagrams = function(strs) {
    const groups = new Map();
    for (const s of strs) {
        const key = [...s].sort().join('');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(s);
    }
    return [...groups.values()];
};`,
  ed: { approach: `<p>Two words are anagrams exactly when their sorted letters match. Use the sorted word as a key in a hash map and collect the words under it. Counting letters into a 26-slot key avoids the sort.</p>`, time: 'O(n · k log k)', space: 'O(n · k)' },
},
{
  slug: 'product-of-array-except-self', title: 'Product of Array Except Self', diff: 'Medium', tags: ['Array', 'Prefix Sum'],
  fn: 'productExceptSelf', params: [['nums', 'number[]']], ret: 'number[]',
  desc: `<p>Return an array <code>answer</code> where <code>answer[i]</code> is the product of every element of <code>nums</code> except <code>nums[i]</code>.</p><p>Run in O(n) time and don't use division. Every prefix and suffix product fits in a 32-bit integer.</p>`,
  examples: [{ args: [[1, 2, 3, 4]] }, { args: [[-1, 1, 0, -3, 3]] }],
  constraints: ['2 ≤ nums.length ≤ 10<sup>5</sup>', '-30 ≤ nums[i] ≤ 30'],
  followup: 'Can you use only O(1) extra space, not counting the output array?',
  gen(R, i) {
    if (i < 28) return [R.arr(R.int(2, 12), -6, 6)];
    const n = R.int(50000, 100000), nums = Array.from({ length: n }, () => R.pick([1, -1]));
    for (let k = R.int(0, 25); k > 0; k--) nums[R.int(0, n - 1)] = R.pick([2, -2]);
    if (R.chance(0.3)) nums[R.int(0, n - 1)] = 0;
    if (R.chance(0.15)) nums[R.int(0, n - 1)] = 0;
    return [nums];
  },
  ref: `var productExceptSelf = function(nums) {
    const n = nums.length, out = new Array(n).fill(1);
    let left = 1;
    for (let i = 0; i < n; i++) { out[i] = left; left *= nums[i]; }
    let right = 1;
    for (let i = n - 1; i >= 0; i--) { out[i] *= right; right *= nums[i]; }
    return out;
};`,
  ed: { approach: `<p><code>answer[i]</code> is (product of everything left of i) × (product of everything right of i). Fill in the left products in one pass, then sweep from the right multiplying in a running suffix product. No division, and no second array.</p>`, time: 'O(n)', space: 'O(1) extra' },
},
{
  slug: 'number-of-islands', title: 'Number of Islands', diff: 'Medium', tags: ['Matrix', 'Depth-First Search', 'Union Find'],
  fn: 'numIslands', params: [['grid', 'character[][]']], ret: 'number',
  desc: `<p><code>grid</code> is an <code>m × n</code> map of <code>"1"</code> (land) and <code>"0"</code> (water). An island is a group of land cells connected horizontally or vertically. Count the islands. Everything outside the grid is water.</p>`,
  examples: [
    { args: [[['1', '1', '1', '1', '0'], ['1', '1', '0', '1', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '0', '0', '0']]] },
    { args: [[['1', '1', '0', '0', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '1', '0', '0'], ['0', '0', '0', '1', '1']]], note: 'Diagonal neighbours don\'t connect, so the lone centre cell is its own island.' },
  ],
  constraints: ['1 ≤ m, n ≤ 60', 'grid[i][j] is <code>"0"</code> or <code>"1"</code>'],
  gen(R, i) {
    const big = i >= 28, m = big ? R.int(30, 60) : R.int(1, 7), n = big ? R.int(30, 60) : R.int(1, 7), d = R.pick([0.15, 0.35, 0.5, 0.65]);
    return [Array.from({ length: m }, () => Array.from({ length: n }, () => R.chance(d) ? '1' : '0'))];
  },
  ref: `var numIslands = function(grid) {
    const m = grid.length, n = grid[0].length;
    let count = 0;
    for (let r = 0; r < m; r++) {
        for (let c = 0; c < n; c++) {
            if (grid[r][c] !== '1') continue;
            count++;
            grid[r][c] = '0';
            const stack = [[r, c]];
            while (stack.length) {
                const [y, x] = stack.pop();
                for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < m && nx >= 0 && nx < n && grid[ny][nx] === '1') {
                        grid[ny][nx] = '0';
                        stack.push([ny, nx]);
                    }
                }
            }
        }
    }
    return count;
};`,
  ed: { approach: `<p>Scan the grid. Each time you reach land that hasn't been visited, count a new island and flood-fill it: mark every connected land cell as visited with a DFS or BFS so it isn't counted again.</p>`, time: 'O(m · n)', space: 'O(m · n)' },
},
{
  slug: 'coin-change', title: 'Coin Change', diff: 'Medium', tags: ['Dynamic Programming', 'Breadth-First Search'],
  fn: 'coinChange', params: [['coins', 'number[]'], ['amount', 'number']], ret: 'number',
  desc: `<p>You have coins in the denominations listed in <code>coins</code>, with an unlimited supply of each. Return the fewest coins that add up to exactly <code>amount</code>, or <code>-1</code> if no combination does.</p>`,
  examples: [{ args: [[1, 2, 5], 11], note: '11 = 5 + 5 + 1' }, { args: [[2], 3] }, { args: [[1], 0] }],
  constraints: ['1 ≤ coins.length ≤ 12', '1 ≤ coins[i] ≤ 2<sup>31</sup> − 1', '0 ≤ amount ≤ 10<sup>4</sup>'],
  gen(R, i) {
    const big = i >= 28, coins = R.distinct(R.int(1, big ? 11 : 4), 1, big ? 400 : 12);
    if (R.chance(0.1)) coins.push(2147483647);
    return [coins, big ? R.int(1000, 10000) : R.int(0, 40)];
  },
  ref: `var coinChange = function(coins, amount) {
    const dp = new Array(amount + 1).fill(Infinity);
    dp[0] = 0;
    for (let a = 1; a <= amount; a++) {
        for (const c of coins) {
            if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
        }
    }
    return dp[amount] === Infinity ? -1 : dp[amount];
};`,
  ed: { approach: `<p>Bottom-up dynamic programming: <code>dp[a]</code> is the fewest coins that make amount <code>a</code>. For each amount, try every coin: <code>dp[a] = min(dp[a], dp[a − c] + 1)</code>.</p><p>Greedy (largest coin first) is wrong: with coins <code>[1,3,4]</code> and amount 6 it picks 4 + 1 + 1 instead of 3 + 3.</p>`, time: 'O(amount · coins)', space: 'O(amount)' },
},
{
  slug: 'merge-intervals', title: 'Merge Intervals', diff: 'Medium', tags: ['Array', 'Sorting'],
  fn: 'merge', params: [['intervals', 'number[][]']], ret: 'number[][]', anyAnswer: true,
  desc: `<p>Each <code>intervals[i] = [start, end]</code> is a closed range. Merge every set of overlapping intervals and return the non-overlapping intervals that cover the same ground. Intervals that only touch, like <code>[1,4]</code> and <code>[4,5]</code>, count as overlapping. Any output order is accepted.</p>`,
  examples: [{ args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], note: '<code>[1,3]</code> and <code>[2,6]</code> overlap, so they merge into <code>[1,6]</code>.' }, { args: [[[1, 4], [4, 5]]] }, { args: [[[4, 7], [1, 4]]] }],
  constraints: ['1 ≤ intervals.length ≤ 10<sup>4</sup>', '0 ≤ start ≤ end ≤ 10<sup>4</sup>'],
  check(args, out, exp) {
    if (!Array.isArray(out)) return false;
    const norm = a => JSON.stringify([...a].sort((p, q) => p[0] - q[0] || p[1] - q[1]));
    return norm(out) === norm(exp);
  },
  gen(R, i) {
    const big = i >= 28, cap = big ? 10000 : 20, span = big ? R.pick([2, 10, 60]) : 5;
    return [Array.from({ length: big ? R.int(2000, 10000) : R.int(1, 7) }, () => { const s = R.int(0, cap); return [s, Math.min(cap, s + R.int(0, span))]; })];
  },
  ref: `var merge = function(intervals) {
    intervals.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [s, e] of intervals) {
        const last = out[out.length - 1];
        if (last && s <= last[1]) last[1] = Math.max(last[1], e);
        else out.push([s, e]);
    }
    return out;
};`,
  ed: { approach: `<p>Sort by start. Walk the intervals: if one starts at or before the end of the last merged interval, extend that end; otherwise begin a new merged interval.</p>`, time: 'O(n log n)', space: 'O(n)' },
},
{
  slug: 'edit-distance', title: 'Edit Distance', diff: 'Medium', tags: ['String', 'Dynamic Programming'],
  fn: 'minDistance', params: [['word1', 'string'], ['word2', 'string']], ret: 'number',
  desc: `<p>Return the fewest operations that turn <code>word1</code> into <code>word2</code>. One operation inserts a character, deletes a character, or replaces a character.</p>`,
  examples: [{ args: ['horse', 'ros'], note: 'horse → rorse (replace h with r) → rose (delete r) → ros (delete e).' }, { args: ['intention', 'execution'] }],
  constraints: ['0 ≤ word1.length, word2.length ≤ 500', 'Both words contain lowercase English letters'],
  gen(R, i) {
    const big = i >= 28, al = R.pick(['ab', 'abcde', LOWER]);
    const w1 = R.str(R.int(0, big ? 500 : 7), al);
    let w2;
    if (R.chance(0.5)) {
      const a = w1.split('');
      for (let k = R.int(0, big ? 60 : 3); k > 0; k--) {
        const op = R.int(0, 2), at = R.int(0, a.length);
        if (op === 0) a.splice(at, 0, R.pick(al));
        else if (a.length) { const idx = Math.min(at, a.length - 1); if (op === 1) a.splice(idx, 1); else a[idx] = R.pick(al); }
      }
      w2 = a.join('').slice(0, 500);
    } else w2 = R.str(R.int(0, big ? 500 : 7), al);
    return [w1, w2];
  },
  ref: `var minDistance = function(word1, word2) {
    const m = word1.length, n = word2.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = word1[i - 1] === word2[j - 1]
                ? prev[j - 1]
                : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
        }
        prev = cur;
    }
    return prev[n];
};`,
  ed: { approach: `<p><code>dp[i][j]</code> is the edit distance between the first <code>i</code> letters of word1 and the first <code>j</code> of word2. If those last letters match, carry over <code>dp[i−1][j−1]</code>; otherwise take 1 plus the cheapest of replace (<code>dp[i−1][j−1]</code>), delete (<code>dp[i−1][j]</code>) or insert (<code>dp[i][j−1]</code>). Only the previous row is ever needed.</p>`, time: 'O(m · n)', space: 'O(n)' },
},
{
  slug: 'trapping-rain-water', title: 'Trapping Rain Water', diff: 'Hard', tags: ['Array', 'Two Pointers', 'Monotonic Stack'],
  fn: 'trap', params: [['height', 'number[]']], ret: 'number', figure: trapFigure,
  desc: `<p><code>height</code> is an elevation map where every bar is 1 unit wide. After it rains, how many units of water are held between the bars?</p>`,
  examples: [{ args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], note: 'The dips hold 1 + 1 + 2 + 1 + 1 = 6 units.' }, { args: [[4, 2, 0, 3, 2, 5]] }],
  constraints: ['1 ≤ height.length ≤ 2 · 10<sup>4</sup>', '0 ≤ height[i] ≤ 10<sup>5</sup>'],
  gen(R, i) { const big = i >= 28; return [R.arr(big ? R.int(10000, 20000) : R.int(1, 14), 0, R.pick(big ? [10, 1000, 100000] : [4, 9]))]; },
  ref: `var trap = function(height) {
    let l = 0, r = height.length - 1, leftMax = 0, rightMax = 0, water = 0;
    while (l < r) {
        if (height[l] < height[r]) {
            leftMax = Math.max(leftMax, height[l]);
            water += leftMax - height[l];
            l++;
        } else {
            rightMax = Math.max(rightMax, height[r]);
            water += rightMax - height[r];
            r--;
        }
    }
    return water;
};`,
  ed: { approach: `<p>The water above bar <code>i</code> is <code>min(tallest bar to its left, tallest bar to its right) − height[i]</code>. Two pointers move inward from both ends: whichever side has the lower wall is the bottleneck, so the water on that side can be settled immediately and the pointer advanced.</p>`, time: 'O(n)', space: 'O(1)' },
},
{
  slug: 'median-of-two-sorted-arrays', title: 'Median of Two Sorted Arrays', diff: 'Hard', tags: ['Array', 'Binary Search', 'Divide and Conquer'],
  fn: 'findMedianSortedArrays', params: [['nums1', 'number[]'], ['nums2', 'number[]']], ret: 'number', float: true,
  desc: `<p>Given two sorted arrays <code>nums1</code> (length m) and <code>nums2</code> (length n), return the median of all their elements combined.</p><p>Answers within 10<sup>-5</sup> of the true median are accepted.</p>`,
  examples: [{ args: [[1, 3], [2]], note: 'Merged: [1,2,3]. The median is 2.' }, { args: [[1, 2], [3, 4]], note: 'Merged: [1,2,3,4]. The median is (2 + 3) / 2 = 2.5.' }],
  constraints: ['0 ≤ m, n ≤ 1000', '1 ≤ m + n ≤ 2000', '-10<sup>6</sup> ≤ nums1[i], nums2[i] ≤ 10<sup>6</sup>'],
  followup: 'Aim for O(log(m + n)) time.',
  gen(R, i) {
    const big = i >= 28, lim = big ? 1000 : 5, v = big ? 1e6 : 20;
    let a, b; do { a = R.int(0, lim); b = R.int(0, lim); } while (a + b === 0);
    const srt = n => R.arr(n, -v, v).sort((x, y) => x - y);
    return [srt(a), srt(b)];
  },
  ref: `var findMedianSortedArrays = function(nums1, nums2) {
    if (nums1.length > nums2.length) [nums1, nums2] = [nums2, nums1];
    const m = nums1.length, n = nums2.length, half = (m + n + 1) >> 1;
    let lo = 0, hi = m;
    while (lo <= hi) {
        const i = (lo + hi) >> 1, j = half - i;
        const aL = i > 0 ? nums1[i - 1] : -Infinity;
        const aR = i < m ? nums1[i] : Infinity;
        const bL = j > 0 ? nums2[j - 1] : -Infinity;
        const bR = j < n ? nums2[j] : Infinity;
        if (aL <= bR && bL <= aR) {
            const left = Math.max(aL, bL);
            if ((m + n) % 2) return left;
            return (left + Math.min(aR, bR)) / 2;
        }
        if (aL > bR) hi = i - 1;
        else lo = i + 1;
    }
};`,
  ed: { approach: `<p>Binary-search a cut in the shorter array. Together with the matching cut in the other array, the two left halves must hold half of all the elements, and every left value must be ≤ every right value. When that holds, the median sits right at the cut.</p><p>A linear merge also passes these tests, but misses the O(log(m + n)) follow-up.</p>`, time: 'O(log min(m, n))', space: 'O(1)' },
},
{
  slug: 'sliding-window-maximum', title: 'Sliding Window Maximum', diff: 'Hard', tags: ['Array', 'Queue', 'Monotonic Queue'],
  fn: 'maxSlidingWindow', params: [['nums', 'number[]'], ['k', 'number']], ret: 'number[]',
  desc: `<p>A window of size <code>k</code> slides over <code>nums</code> from left to right, one position at a time. Return the largest value inside the window at each position.</p>`,
  examples: [{ args: [[1, 3, -1, -3, 5, 3, 6, 7], 3], note: 'Windows: [1 3 -1] → 3, [3 -1 -3] → 3, [-1 -3 5] → 5, [-3 5 3] → 5, [5 3 6] → 6, [3 6 7] → 7.' }, { args: [[1], 1] }],
  constraints: ['1 ≤ nums.length ≤ 10<sup>5</sup>', '-10<sup>4</sup> ≤ nums[i] ≤ 10<sup>4</sup>', '1 ≤ k ≤ nums.length'],
  gen(R, i) {
    const big = i >= 28, n = big ? R.int(50000, 100000) : R.int(1, 10);
    return [R.arr(n, -10000, 10000), big ? R.pick([1, R.int(1, n), n >> 1, n]) : R.int(1, n)];
  },
  ref: `var maxSlidingWindow = function(nums, k) {
    const dq = new Int32Array(nums.length);
    let head = 0, tail = 0;
    const out = [];
    for (let i = 0; i < nums.length; i++) {
        while (tail > head && nums[dq[tail - 1]] <= nums[i]) tail--;
        dq[tail++] = i;
        if (dq[head] <= i - k) head++;
        if (i >= k - 1) out.push(nums[dq[head]]);
    }
    return out;
};`,
  ed: { approach: `<p>Keep a deque of indices whose values are decreasing. Before pushing index <code>i</code>, pop smaller values off the back, since they can never be a window's maximum again. Drop the front once it slides out of the window. The front is always the current maximum.</p><p>Rescanning each window is O(n · k) and times out when k is large.</p>`, time: 'O(n)', space: 'O(k)' },
},
];
PROBLEMS.forEach((p, i) => { p.id = i + 1; });
const BY_SLUG = Object.fromEntries(PROBLEMS.map(p => [p.slug, p]));
const TAGS = [...new Set(PROBLEMS.flatMap(p => p.tags))].sort();

function starter(p) {
  const types = p.params.map(x => x[1]).concat(p.ret);
  let head = '';
  if (types.includes('ListNode')) head += '/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n';
  if (types.includes('TreeNode')) head += '/**\n * Definition for a binary tree node.\n * function TreeNode(val, left, right) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.left = (left===undefined ? null : left)\n *     this.right = (right===undefined ? null : right)\n * }\n */\n';
  const doc = '/**\n' + p.params.map(([n, t]) => ` * @param {${t}} ${n}\n`).join('') + ` * @return {${p.ret}}\n */\n`;
  return head + doc + `var ${p.fn} = function(${p.params.map(x => x[0]).join(', ')}) {\n    \n};\n`;
}
const defaultCases = p => p.examples.map(e => e.args.map(a => JSON.stringify(a)));
