Feature: Leaving a session

  Leaving the Workspace can lose work: changes no saved file holds, and, in a
  live session, the session itself for everyone still in it. Leaving asks first
  and names each loss, so neither hides the other.

  How unsaved changes are worked out is specified in
  session-persistence/domain/what-counts-as-unsaved.feature.

  Rule: Leaving asks first and names each loss

    Scenario Outline: What leaving asks
      Given a <mode> session with <teammates> teammates still connected
      And the session <saved>
      When the facilitator leaves the Workspace
      Then leaving <asks>

      Examples:
        | mode   | teammates | saved                  | asks                                                     |
        | Manual | 0         | has no unsaved changes | goes ahead without asking                                |
        | Manual | 0         | has unsaved changes    | asks first, naming the unsaved changes                   |
        | Live   | 0         | has no unsaved changes | goes ahead without asking                                |
        | Live   | 2         | has no unsaved changes | asks first, naming the live teammates                    |
        | Live   | 2         | has unsaved changes    | asks first, naming the unsaved changes and the teammates |

  Rule: Only the facilitator holds a session that can be saved

    Scenario Outline: Who holds the session
      Given a <role> in a <mode> session
      Then they <hold> a session that can be saved

      Examples:
        | role        | mode   | hold       |
        | facilitator | Manual | hold       |
        | facilitator | Live   | hold       |
        | participant | Live   | don't hold |
