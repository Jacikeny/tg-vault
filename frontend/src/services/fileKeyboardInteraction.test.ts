import assert from 'node:assert/strict';
import test from 'node:test';
import { activateParentControl } from './keyboardActivation.js';

function event(key: string, target: object, currentTarget: object) {
    let prevented = 0;
    return {
        value: { key, target, currentTarget, preventDefault: () => { prevented += 1; } },
        prevented: () => prevented,
    };
}

test('focused parent handles Enter and Space exactly once', () => {
    const parent = {};
    for (const key of ['Enter', ' ']) {
        const input = event(key, parent, parent);
        let actions = 0;
        assert.equal(activateParentControl(input.value, () => { actions += 1; }), true);
        assert.equal(actions, 1);
        assert.equal(input.prevented(), 1);
    }
});

test('a child button keyboard event never activates the parent action', () => {
    const input = event('Enter', {}, {});
    let actions = 0;
    assert.equal(activateParentControl(input.value, () => { actions += 1; }), false);
    assert.equal(actions, 0);
    assert.equal(input.prevented(), 0);
});

test('selection action is invoked once for one parent keyboard input', () => {
    const parent = {};
    const input = event(' ', parent, parent);
    let selections = 0;
    activateParentControl(input.value, () => { selections += 1; });
    assert.equal(selections, 1);
});
