// AgentConsensus Contract ABI and Address
// Deployed to Botchain
export const AGENT_CONSENSUS_ADDRESS = "0x97cB6DdA7C05ca1216FFB0303B6851D692E3ec0E";

export const AGENT_CONSENSUS_ABI = [
    // Event Registry
    {
        "inputs": [
            { "internalType": "string", "name": "eventId", "type": "string" },
            { "internalType": "string", "name": "eventCode", "type": "string" }
        ],
        "name": "createEvent",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "eventId", "type": "string" }],
        "name": "closeEvent",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "eventId", "type": "string" }],
        "name": "getEvent",
        "outputs": [
            { "internalType": "string", "name": "", "type": "string" },
            { "internalType": "string", "name": "", "type": "string" },
            { "internalType": "address", "name": "", "type": "address" },
            { "internalType": "uint256", "name": "", "type": "uint256" },
            { "internalType": "bool", "name": "", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "host", "type": "address" }],
        "name": "getHostEventIds",
        "outputs": [{ "internalType": "string[]", "name": "", "type": "string[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalEvents",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "eventId", "type": "string" }],
        "name": "isEventActive",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    // Sharded Voting
    {
        "inputs": [
            { "internalType": "string", "name": "eventId", "type": "string" },
            { "internalType": "string[]", "name": "submissionIds", "type": "string[]" },
            { "internalType": "uint256[]", "name": "voteCounts", "type": "uint256[]" }
        ],
        "name": "submitVotes",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "voter", "type": "address" },
            { "internalType": "string", "name": "eventId", "type": "string" }
        ],
        "name": "getVoterVotes",
        "outputs": [
            { "internalType": "string[]", "name": "submissionIds", "type": "string[]" },
            { "internalType": "uint256[]", "name": "voteCounts", "type": "uint256[]" },
            { "internalType": "uint256[]", "name": "voteCosts", "type": "uint256[]" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "eventId", "type": "string" },
            { "internalType": "string", "name": "submissionId", "type": "string" }
        ],
        "name": "getSubmissionScore",
        "outputs": [{ "internalType": "uint256", "name": "totalScore", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "voter", "type": "address" },
            { "internalType": "string", "name": "eventId", "type": "string" }
        ],
        "name": "hasVoterVoted",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "eventId", "type": "string" }],
        "name": "getEventVoterCount",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "eventId", "type": "string" }],
        "name": "getEventVoters",
        "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    // Events
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "string", "name": "eventId", "type": "string" },
            { "indexed": false, "internalType": "string", "name": "eventCode", "type": "string" },
            { "indexed": true, "internalType": "address", "name": "host", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "name": "EventCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "string", "name": "eventId", "type": "string" },
            { "indexed": true, "internalType": "address", "name": "host", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "name": "EventClosed",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "voter", "type": "address" },
            { "indexed": true, "internalType": "string", "name": "eventId", "type": "string" },
            { "indexed": false, "internalType": "string", "name": "submissionId", "type": "string" },
            { "indexed": false, "internalType": "uint256", "name": "votes", "type": "uint256" }
        ],
        "name": "VoteCast",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "voter", "type": "address" },
            { "indexed": true, "internalType": "string", "name": "eventId", "type": "string" },
            { "indexed": false, "internalType": "uint256", "name": "totalCreditsUsed", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "name": "VotesSubmitted",
        "type": "event"
    }
] as const;

// Legacy export for backwards compatibility during migration
export const EVENT_FACTORY_ADDRESS = AGENT_CONSENSUS_ADDRESS;
export const EVENT_FACTORY_ABI = AGENT_CONSENSUS_ABI;
