import "dotenv/config";
import { findBestChannelPartner } from "./src/geo-router.service";

async function main() {
  const userAddress = process.argv[2] || "Park Street, Kolkata";
  const schemeId = process.argv[3] || "scheme-mcf-001";

  console.log(`\n========================================`);
  console.log(`Geo-Routing Channel Partner Selection`);
  console.log(`========================================`);
  console.log(`User Address : ${userAddress}`);
  console.log(`Scheme ID    : ${schemeId}\n`);

  try {
    const result = await findBestChannelPartner(userAddress, schemeId);

    if (!result) {
      console.log("No eligible partner found for the given criteria.");
      return;
    }

    console.log("Optimal Channel Partner Match:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("Error running geo-router:", error.message || error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { findBestChannelPartner } from "./src/geo-router.service";
