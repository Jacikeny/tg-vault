import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrivateAddress } from './networkSecurity.js';

test('rejects ambiguous IPv4 forms before DNS or URL admission', () => {
    for (const address of [
        '127.0.0.1/8',
        '127.000.000.001',
        '0177.0.0.1',
        '2130706433',
        '0x7f000001',
    ]) {
        assert.equal(isPrivateAddress(address), true, address);
    }
});

test('rejects IPv4-mapped and NAT64 IPv6 encodings of private IPv4 addresses', () => {
    for (const address of [
        '::ffff:127.0.0.1',
        '::ffff:7f00:1',
        '64:ff9b::127.0.0.1',
        '64:ff9b::7f00:1',
    ]) {
        assert.equal(isPrivateAddress(address), true, address);
    }
});

test('keeps ordinary public IPv4 and IPv6 addresses admissible', () => {
    assert.equal(isPrivateAddress('8.8.8.8'), false);
    assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
});

test('rejects metadata, carrier-grade NAT, benchmark, documentation and non-global IPv6 ranges', () => {
    for (const address of [
        '100.100.100.200',
        '100.64.0.1',
        '198.18.0.1',
        '192.0.2.1',
        'fe90::1',
        'ff02::1',
        '2001:db8::1',
        '2002:7f00:1::',
    ]) {
        assert.equal(isPrivateAddress(address), true, address);
    }
});
