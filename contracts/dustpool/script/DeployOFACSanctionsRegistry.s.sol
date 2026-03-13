// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {OFACSanctionsRegistry} from "../src/OFACSanctionsRegistry.sol";

interface IDustPoolV2 {
    function setComplianceOracle(address oracle) external;
    function complianceOracle() external view returns (address);
}

contract DeployOFACSanctionsRegistry is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        OFACSanctionsRegistry registry = new OFACSanctionsRegistry();
        console.log("OFACSanctionsRegistry:", address(registry));

        address dustPoolV2 = vm.envOr("DUSTPOOL_V2_ADDRESS", address(0));
        if (dustPoolV2 != address(0)) {
            address oldOracle = IDustPoolV2(dustPoolV2).complianceOracle();
            IDustPoolV2(dustPoolV2).setComplianceOracle(address(registry));
            console.log("DustPoolV2:", dustPoolV2);
            console.log("  Previous oracle:", oldOracle);
            console.log("  New oracle:     ", address(registry));
        }

        vm.stopBroadcast();
    }
}
