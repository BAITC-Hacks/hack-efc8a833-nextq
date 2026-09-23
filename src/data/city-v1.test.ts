import assert from "node:assert/strict";
import { test } from "node:test";
import { directions } from "../domain/model";
import { cityV1 } from "./city-v1";

test("city-1 contains six districts with unique IDs", () => {
  assert.equal(cityV1.districts.length, 6);
  assert.equal(new Set(cityV1.districts.map((district) => district.id)).size, 6);
});

test("district populations sum to 100", () => {
  assert.equal(cityV1.districts.reduce((sum, district) => sum + district.population, 0), 100);
});

test("each district has an initial indicator mean of 50", () => {
  for (const district of cityV1.districts) {
    const mean = directions.reduce((sum, direction) => sum + district.indicators[direction], 0) / directions.length;
    assert.equal(mean, 50, district.id);
  }
});

test("initiative IDs are unique", () => {
  assert.equal(new Set(cityV1.initiatives.map((initiative) => initiative.id)).size, cityV1.initiatives.length);
});

test("each direction contains exactly three initiatives", () => {
  assert.equal(cityV1.initiatives.length, directions.length * 3);
  for (const direction of directions) {
    assert.equal(cityV1.initiatives.filter((initiative) => initiative.direction === direction).length, 3, direction);
  }
});

test("each direction offers a free option without indicator changes", () => {
  for (const direction of directions) {
    assert.ok(cityV1.initiatives.some((initiative) =>
      initiative.direction === direction && initiative.cost === 0 &&
      Object.values(initiative.deltas).every((delta) => delta === 0),
    ), direction);
  }
});

test("synergy pairs reference existing initiative IDs", () => {
  const initiativeIds = new Set(cityV1.initiatives.map((initiative) => initiative.id));
  assert.ok(cityV1.pairInteractions.length > 0);
  for (const interaction of cityV1.pairInteractions) {
    assert.equal(interaction.initiativeIds.length, 2);
    for (const id of interaction.initiativeIds) {
      assert.ok(initiativeIds.has(id), `Unknown synergy initiative: ${id}`);
    }
  }
});

test("synergy IDs are strictly sorted and pairs are unique", () => {
  const pairs = new Set<string>();
  for (const interaction of cityV1.pairInteractions) {
    const [first, second] = interaction.initiativeIds;
    assert.ok(first < second, `Unsorted synergy IDs: ${first}, ${second}`);
    const key = JSON.stringify(interaction.initiativeIds);
    assert.ok(!pairs.has(key), `Duplicate synergy pair: ${key}`);
    pairs.add(key);
  }
});
