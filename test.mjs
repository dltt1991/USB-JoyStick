import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

assert.ok(existsSync('index.html'), '尚未实现 index.html');
const html = readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Only browser boundaries are simulated; the actual page script runs unchanged.
function setup({ secure = true, supported = true } = {}) {
  const elements = new Map();
  class Element {
    constructor() { this.value = ''; this.textContent = ''; this.children = []; this.style = {}; this.dataset = {}; this.checked = false; this.handlers = {}; }
    replaceChildren(...children) { this.children = children; this.value = children[0]?.value ?? ''; }
    append(...children) { this.children.push(...children); if (!this.value) this.value = children[0]?.value ?? ''; }
    addEventListener(type, handler) { this.handlers[type] = handler; }
  }
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element());
  let pads = [], next;
  const navigator = supported ? { getGamepads: () => pads } : {};
  const context = {
    document: { getElementById: id => elements.get(id), createElement: () => new Element() },
    navigator, window: { isSecureContext: secure },
    requestAnimationFrame: callback => { next = callback; },
    Option: function(text, value) { const el = new Element(); el.textContent = text; el.value = String(value); return el; },
  };
  vm.runInNewContext(script, context);
  return { elements, navigator, tick(data) { pads = data; const callback = next; next = null; callback?.(); } };
}

const app = setup();
const el = id => app.elements.get(id);
app.tick([]);
assert.match(el('status').textContent, /等待/);
assert.equal(el('x-value').textContent, '—');
const pad = { index: 2, id: '<USB Hall Joystick>', connected: true, axes: [0.9081, -0.9062, 0.9081] };
app.tick([null, null, pad]);
assert.equal(el('device-name').textContent, pad.id);
assert.equal(el('x-value').textContent, '-70.7%');
assert.equal(el('y-value').textContent, '-70.7%');
assert.ok(Math.abs(parseFloat(el('dot').style.left) - (50 - 50 / Math.sqrt(2))) < 1e-10);
assert.ok(Math.abs(parseFloat(el('dot').style.top) - (50 - 50 / Math.sqrt(2))) < 1e-10);
assert.ok(Math.abs(el('x-meter').value + 1 / Math.sqrt(2)) < 1e-12);
assert.ok(Math.abs(el('y-meter').value + 1 / Math.sqrt(2)) < 1e-12);
app.tick([null, null, { ...pad, axes: [-0.7752, 0.8025, 0.9081] }]);
assert.equal(el('x-value').textContent, '+70.7%');
assert.equal(el('y-value').textContent, '+70.7%');
el('invert-y').checked = true;
app.tick([null, null, pad]);
assert.equal(el('y-value').textContent, '+70.7%');
el('invert-y').checked = false;
el('x-axis').value = '2';
app.tick([null, null, pad]);
assert.equal(el('y-value').textContent, '-70.7%');
el('invert-x').checked = true;
app.tick([null, null, pad]);
assert.equal(el('x-value').textContent, '+70.7%');
app.tick([null, null, { ...pad, axes: [1, 0] }]);
assert.equal(el('x-value').textContent, '0.0%');
assert.equal(el('y-value').textContent, '-100.0%');
app.tick([null, null, { ...pad, axes: [0] }]);
assert.equal(el('x-value').textContent, '—');
assert.match(el('status').textContent, /不足/);
app.tick([]);
assert.equal(el('x-value').textContent, '—');
assert.equal(el('device-name').textContent, '尚未检测到设备');
assert.equal(el('dot').style.visibility, 'hidden');
const pad2 = { index: 4, id: 'Second', connected: true, axes: [-0.7752, 0.8025] };
app.tick([pad, pad2]);
el('device').value = '4';
el('invert-x').checked = false;
app.tick([pad, pad2]);
assert.equal(el('device-name').textContent, 'Second');
assert.equal(el('y-value').textContent, '+70.7%');
app.tick([{ ...pad2, axes: [NaN, Infinity] }]);
assert.equal(el('x-value').textContent, '—');
assert.equal(el('y-value').textContent, '—');
assert.equal(el('dot').style.visibility, 'hidden');
app.navigator.getGamepads = () => { throw new Error('blocked'); };
app.tick([]);
assert.match(el('status').textContent, /无法访问/);
assert.equal(el('y-value').textContent, '—');
assert.match(setup({ supported: false }).elements.get('status').textContent, /不支持/);
assert.match(setup({ secure: false }).elements.get('status').textContent, /localhost/);

const calibration = setup();
const sample = (x, y, expectedX, expectedY) => {
  calibration.tick([{ ...pad, axes: [x, y] }]);
  assert.equal(calibration.elements.get('x-value').textContent, expectedX, `原始 Y=${y}`);
  assert.equal(calibration.elements.get('y-value').textContent, expectedY, `原始 X=${x}`);
};
sample(0, 0, '0.0%', '0.0%');
sample(-0.002, 0, '0.0%', '0.0%');
sample(0, 0.002, '0.0%', '0.0%');
sample(0.0012, -0.0016, '0.0%', '0.0%');
sample(0.001, -0.001, '0.0%', '0.0%');
sample(-0.7752, -0.9062, '-70.7%', '+70.7%');
sample(0.9081, 0.8025, '+70.7%', '-70.7%');
sample(0.9081 * 2, 0.8025 * 2, '+70.7%', '-70.7%');
sample(0.09261, 0, '0.0%', '-10.0%');
sample(0, -0.09242, '-10.0%', '0.0%');
// A point halfway from the raw circular deadzone to an oblique calibrated boundary.
const boundaryX = 0.9081 * 0.6;
const boundaryY = 0.8025 * 0.8;
const boundaryRadius = Math.hypot(boundaryX, boundaryY);
const halfScale = (boundaryRadius + 0.002) / (2 * boundaryRadius);
sample(boundaryX * halfScale, boundaryY * halfScale, '+40.0%', '-30.0%');
sample(boundaryX, boundaryY, '+80.0%', '-60.0%');
sample(boundaryX * 3, boundaryY * 3, '+80.0%', '-60.0%');
// A diagonal point outside radius 0.002 must move even if both components are under 0.002.
calibration.tick([{ ...pad, axes: [0.0019, 0.0019] }]);
assert.ok(Math.hypot(calibration.elements.get('x-meter').value, calibration.elements.get('y-meter').value) > 0);
// Sweep all quadrants: output always stays inside the circle, including extreme raw input.
for (const x of [-2, -0.7752, -0.2, -0.001, 0, 0.001, 0.3, 0.9081, 2]) {
  for (const y of [-2, -0.9062, -0.2, -0.001, 0, 0.001, 0.3, 0.8025, 2]) {
    calibration.tick([{ ...pad, axes: [x, y] }]);
    const outX = calibration.elements.get('x-meter').value;
    const outY = calibration.elements.get('y-meter').value;
    assert.ok(Math.hypot(outX, outY) <= 1 + 1e-12, `超出圆周: ${x}, ${y}`);
    assert.ok(Math.hypot((parseFloat(calibration.elements.get('dot').style.left) - 50) / 50,
      (parseFloat(calibration.elements.get('dot').style.top) - 50) / 50) <= 1 + 1e-12);
  }
}
// Original right becomes up; original down becomes right after visual left rotation.
sample(0.9081, 0, '0.0%', '-100.0%');
assert.equal(calibration.elements.get('dot').style.top, '0%');
sample(0, 0.8025, '+100.0%', '0.0%');
assert.equal(calibration.elements.get('dot').style.left, '100%');
console.log('通过：连接、实时更新、选择、反向、断开、错误、非对称行程、圆形死区、径向归一化、圆周截断、全象限圆内约束和左旋 90°。');
