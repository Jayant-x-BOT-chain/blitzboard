// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentConsensus
 * @notice Parallel-execution voting contract for AI agent consensus on Monad.
 *         Uses sharded state to enable concurrent writes without conflicts.
 */
contract AgentConsensus {
    // ==========================================
    // EVENT REGISTRY (unchanged from EventFactory)
    // ==========================================

    struct Event {
        string eventId;
        string eventCode;
        address host;
        uint256 createdAt;
        bool isActive;
    }

    mapping(string => Event) public events;
    mapping(string => bool) private eventCodeUsed;
    string[] public eventIds;
    mapping(address => string[]) public hostEvents;

    event EventCreated(
        string indexed eventId,
        string eventCode,
        address indexed host,
        uint256 timestamp
    );

    event EventClosed(
        string indexed eventId,
        address indexed host,
        uint256 timestamp
    );

    modifier onlyEventHost(string memory eventId) {
        require(events[eventId].host == msg.sender, "Not event host");
        _;
    }

    modifier eventExists(string memory eventId) {
        require(events[eventId].createdAt != 0, "Event not found");
        _;
    }

    function createEvent(
        string memory eventId,
        string memory eventCode
    ) external {
        require(bytes(eventId).length > 0, "Event ID required");
        require(bytes(eventCode).length == 8, "Code must be 8 chars");
        require(events[eventId].createdAt == 0, "Event already exists");
        require(!eventCodeUsed[eventCode], "Event code already used");

        eventCodeUsed[eventCode] = true;

        events[eventId] = Event({
            eventId: eventId,
            eventCode: eventCode,
            host: msg.sender,
            createdAt: block.timestamp,
            isActive: true
        });

        eventIds.push(eventId);
        hostEvents[msg.sender].push(eventId);

        emit EventCreated(eventId, eventCode, msg.sender, block.timestamp);
    }

    function closeEvent(
        string memory eventId
    ) external eventExists(eventId) onlyEventHost(eventId) {
        require(events[eventId].isActive, "Already closed");
        events[eventId].isActive = false;
        emit EventClosed(eventId, msg.sender, block.timestamp);
    }

    function getEvent(
        string memory eventId
    )
        external
        view
        eventExists(eventId)
        returns (string memory, string memory, address, uint256, bool)
    {
        Event memory e = events[eventId];
        return (e.eventId, e.eventCode, e.host, e.createdAt, e.isActive);
    }

    function getHostEventIds(
        address host
    ) external view returns (string[] memory) {
        return hostEvents[host];
    }

    function getTotalEvents() external view returns (uint256) {
        return eventIds.length;
    }

    function isEventActive(
        string memory eventId
    ) external view eventExists(eventId) returns (bool) {
        return events[eventId].isActive;
    }

    // ==========================================
    // SHARDED PARALLEL VOTING (Quadratic)
    // ==========================================

    struct VoteData {
        string submissionId;
        uint256 voteCount;
        uint256 voteCost;
    }

    // SHARDED: Each voter writes to their own storage slot
    // voter => eventId => votes array
    mapping(address => mapping(string => VoteData[])) private voterVotes;

    // SHARDED: Each voter has their own hasVoted flag
    // voter => eventId => has voted
    mapping(address => mapping(string => bool)) public hasVoted;

    // Track voters per event for aggregation
    // eventId => voter addresses
    mapping(string => address[]) private eventVoters;

    uint256 public constant CREDITS_PER_VOTER = 100;

    // Granular event for per-submission aggregation
    event VoteCast(
        address indexed voter,
        string indexed eventId,
        string submissionId,
        uint256 votes
    );

    // Summary event at end of vote
    event VotesSubmitted(
        address indexed voter,
        string indexed eventId,
        uint256 totalCreditsUsed,
        uint256 timestamp
    );

    /**
     * @notice Submit quadratic votes (sharded storage for parallel execution)
     * @param eventId The event to vote in
     * @param submissionIds Array of submission IDs to vote for
     * @param voteCounts Array of vote counts (cost = count^2)
     */
    function submitVotes(
        string memory eventId,
        string[] memory submissionIds,
        uint256[] memory voteCounts
    ) external eventExists(eventId) {
        require(events[eventId].isActive, "Event is closed");
        require(!hasVoted[msg.sender][eventId], "Already voted");
        require(
            submissionIds.length == voteCounts.length,
            "Array length mismatch"
        );
        require(submissionIds.length > 0, "No votes provided");

        uint256 totalCost = 0;

        // Calculate total cost and validate
        for (uint256 i = 0; i < voteCounts.length; i++) {
            require(voteCounts[i] > 0, "Vote count must be > 0");
            uint256 cost = voteCounts[i] * voteCounts[i];
            totalCost += cost;
        }

        require(totalCost <= CREDITS_PER_VOTER, "Exceeds credit limit");

        // Store votes in voter's own shard (PARALLEL SAFE)
        for (uint256 i = 0; i < submissionIds.length; i++) {
            uint256 cost = voteCounts[i] * voteCounts[i];

            voterVotes[msg.sender][eventId].push(
                VoteData({
                    submissionId: submissionIds[i],
                    voteCount: voteCounts[i],
                    voteCost: cost
                })
            );

            // Emit granular event for aggregation
            emit VoteCast(msg.sender, eventId, submissionIds[i], voteCounts[i]);
        }

        // Mark as voted (sharded by voter address)
        hasVoted[msg.sender][eventId] = true;
        eventVoters[eventId].push(msg.sender);

        emit VotesSubmitted(msg.sender, eventId, totalCost, block.timestamp);
    }

    /**
     * @notice Get a voter's votes for an event
     */
    function getVoterVotes(
        address voter,
        string memory eventId
    )
        external
        view
        returns (
            string[] memory submissionIds,
            uint256[] memory voteCounts,
            uint256[] memory voteCosts
        )
    {
        VoteData[] memory votes = voterVotes[voter][eventId];
        uint256 len = votes.length;

        submissionIds = new string[](len);
        voteCounts = new uint256[](len);
        voteCosts = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            submissionIds[i] = votes[i].submissionId;
            voteCounts[i] = votes[i].voteCount;
            voteCosts[i] = votes[i].voteCost;
        }
    }

    /**
     * @notice Check if a voter has voted in an event
     */
    function hasVoterVoted(
        address voter,
        string memory eventId
    ) external view returns (bool) {
        return hasVoted[voter][eventId];
    }

    /**
     * @notice Get list of voters for an event (for off-chain aggregation)
     */
    function getEventVoters(
        string memory eventId
    ) external view returns (address[] memory) {
        return eventVoters[eventId];
    }

    /**
     * @notice Get voter count for an event
     */
    function getEventVoterCount(
        string memory eventId
    ) external view returns (uint256) {
        return eventVoters[eventId].length;
    }

    /**
     * @notice Aggregate scores for a submission (iterates all voters)
     * @dev For large voter counts, prefer off-chain aggregation via VoteCast events
     */
    function getSubmissionScore(
        string memory eventId,
        string memory submissionId
    ) external view returns (uint256 totalScore) {
        address[] memory voters = eventVoters[eventId];

        for (uint256 i = 0; i < voters.length; i++) {
            VoteData[] memory votes = voterVotes[voters[i]][eventId];
            for (uint256 j = 0; j < votes.length; j++) {
                if (
                    keccak256(bytes(votes[j].submissionId)) ==
                    keccak256(bytes(submissionId))
                ) {
                    totalScore += votes[j].voteCount;
                }
            }
        }
    }
}
