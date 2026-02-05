/**
 * Skills System Verification Script
 *
 * Verifies the skills infrastructure works correctly.
 * Run with: npx tsx scripts/verify-skills.ts
 */

import {
  getSkillsMetadata,
  formatSkillsForPrompt,
  loadSkill,
  clearSkillsCache,
} from "../lib/agents/skills";

async function verify() {
  console.log("=== Skills System Verification ===\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Load metadata
  console.log("1. Loading skills metadata...");
  clearSkillsCache();
  const skills = await getSkillsMetadata();
  const testSkill = skills.find((s) => s.name === "test-skill");

  if (testSkill) {
    console.log(`   ✅ Found ${skills.length} skill(s):`);
    skills.forEach((s) => console.log(`      - ${s.name} (${s.category})`));
    passed++;
  } else {
    console.log("   ❌ test-skill not found!");
    failed++;
  }

  // Test 2: Verify test-skill metadata
  console.log("\n2. Verifying test-skill metadata...");
  if (testSkill?.category === "testing" && testSkill?.agents.includes("coder")) {
    console.log("   ✅ Metadata is correct (category=testing, agents include 'coder')");
    passed++;
  } else {
    console.log("   ❌ Metadata is incorrect!");
    console.log(`      Got: category=${testSkill?.category}, agents=${testSkill?.agents}`);
    failed++;
  }

  // Test 3: Format for prompt
  console.log("\n3. Formatting for coder agent...");
  const formatted = formatSkillsForPrompt(skills, "coder");
  if (
    formatted.includes("<available_skills>") &&
    formatted.includes('name="test-skill"') &&
    formatted.includes("load_skill")
  ) {
    console.log(`   ✅ Generated ${formatted.length} chars of prompt content`);
    passed++;
  } else {
    console.log("   ❌ Formatted output is incorrect!");
    failed++;
  }

  // Test 4: Load test-skill
  console.log("\n4. Loading test-skill...");
  const result = await loadSkill("test-skill");
  if (
    result.success &&
    result.content.includes("<skill_instructions") &&
    result.content.includes("TEST_SKILL_LOADED")
  ) {
    console.log("   ✅ Skill loaded successfully");
    console.log(`      Content preview: ${result.content.substring(0, 80)}...`);
    passed++;
  } else {
    console.log("   ❌ Skill loading failed!");
    console.log(`      Success: ${result.success}`);
    failed++;
  }

  // Test 5: Load nonexistent skill
  console.log("\n5. Loading nonexistent skill...");
  const missing = await loadSkill("does-not-exist");
  if (!missing.success && missing.content.includes("not found")) {
    console.log("   ✅ Correctly returned error for missing skill");
    passed++;
  } else {
    console.log("   ❌ Should have failed for missing skill!");
    failed++;
  }

  // Test 6: Cache behavior
  console.log("\n6. Testing cache...");
  const first = await getSkillsMetadata();
  const second = await getSkillsMetadata();
  if (first === second) {
    console.log("   ✅ Cache working (same reference returned)");
    passed++;
  } else {
    console.log("   ❌ Cache not working (different references)!");
    failed++;
  }

  console.log("\n=== Verification Complete ===");
  console.log(`Passed: ${passed}/${passed + failed}`);
  console.log(`Failed: ${failed}/${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
