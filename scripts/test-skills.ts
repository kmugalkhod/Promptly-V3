/**
 * Skills System Test Script
 *
 * Validates that the skills infrastructure is working correctly:
 * 1. getSkillsMetadata() loads skills from /skills directory
 * 2. loadSkill("test-skill") returns skill content
 * 3. formatSkillsForPrompt() generates XML output
 */

import {
  getSkillsMetadata,
  loadSkill,
  formatSkillsForPrompt,
  clearSkillsCache,
} from "../lib/agents/skills";

async function main() {
  console.log("🧪 Testing Skills Infrastructure\n");

  let passed = 0;
  let failed = 0;

  // Clear cache to ensure fresh load
  clearSkillsCache();

  // Test 1: getSkillsMetadata
  console.log("Test 1: getSkillsMetadata()");
  try {
    const skills = await getSkillsMetadata();
    console.log(`  ✓ Loaded ${skills.length} skill(s)`);

    if (skills.length === 0) {
      console.log("  ✗ Expected at least 1 skill (test-skill)");
      failed++;
    } else {
      const testSkill = skills.find((s) => s.name === "test-skill");
      if (testSkill) {
        console.log(`  ✓ Found test-skill: "${testSkill.description}"`);
        passed++;
      } else {
        console.log("  ✗ test-skill not found in metadata");
        failed++;
      }
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    failed++;
  }

  // Test 2: loadSkill
  console.log("\nTest 2: loadSkill('test-skill')");
  try {
    const result = await loadSkill("test-skill");

    if (result.success) {
      console.log(`  ✓ Skill loaded successfully`);

      if (result.content.includes("TEST_SKILL_LOADED")) {
        console.log(`  ✓ Content contains expected text`);
        passed++;
      } else {
        console.log(`  ✗ Content missing expected text`);
        console.log(`    Got: ${result.content.substring(0, 100)}...`);
        failed++;
      }
    } else {
      console.log(`  ✗ Skill load failed: ${result.content}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    failed++;
  }

  // Test 3: loadSkill with non-existent skill
  console.log("\nTest 3: loadSkill('non-existent-skill')");
  try {
    const result = await loadSkill("non-existent-skill");

    if (!result.success) {
      console.log(`  ✓ Correctly returns failure for non-existent skill`);
      passed++;
    } else {
      console.log(`  ✗ Should have returned failure`);
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    failed++;
  }

  // Test 4: formatSkillsForPrompt
  console.log("\nTest 4: formatSkillsForPrompt()");
  try {
    const skills = await getSkillsMetadata();
    const formatted = formatSkillsForPrompt(skills, "coder");

    if (formatted.includes("<available_skills>")) {
      console.log(`  ✓ Output contains <available_skills> tag`);
      passed++;
    } else {
      console.log(`  ✗ Output missing <available_skills> tag`);
      console.log(`    Got: ${formatted.substring(0, 100)}...`);
      failed++;
    }

    if (formatted.includes("load_skill")) {
      console.log(`  ✓ Output mentions load_skill tool`);
      passed++;
    } else {
      console.log(`  ✗ Output missing load_skill mention`);
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    failed++;
  }

  // Test 5: Cache behavior
  console.log("\nTest 5: Cache behavior");
  try {
    const start1 = Date.now();
    await getSkillsMetadata(); // Should use cache
    const duration1 = Date.now() - start1;

    clearSkillsCache();

    const start2 = Date.now();
    await getSkillsMetadata(); // Fresh load
    const duration2 = Date.now() - start2;

    console.log(`  ✓ Cached call: ${duration1}ms, Fresh call: ${duration2}ms`);
    passed++;
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    failed++;
  }

  // Summary
  console.log("\n" + "=".repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\n❌ Some tests failed");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
