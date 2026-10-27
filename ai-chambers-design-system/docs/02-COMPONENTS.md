# Canonical component registry

| Capability        | PatternFly base                              | Owner                 | Delivery level                                         |
| ----------------- | -------------------------------------------- | --------------------- | ------------------------------------------------------ |
| Buttons           | Button, Spinner                              | ActionButton          | Implemented, including fixed busy geometry             |
| Header            | Semantic header                              | PageHeader            | Implemented                                            |
| Fields            | FormGroup, TextInput, HelperText             | Field                 | Implemented                                            |
| Pills             | Label                                        | StatusPill            | Implemented                                            |
| Tables            | react-table, Checkbox                        | RecordTable           | Bounded local-data reference                           |
| Searchable select | Select, MenuToggle, SelectList               | CompactSelect         | Implemented searchable popup                           |
| Nested filters    | Select and controlled fields                 | QueryBuilder          | Implemented ALL/ANY, bounded nesting                   |
| Column controls   | Shared table controls                        | RecordTable           | Pointer/keyboard resize, show/hide, button reorder     |
| Inspector/sheet   | Modal, Header, Body, Footer                  | Inspector             | Implemented modal edge panel/mobile sheet              |
| Context actions   | Dropdown                                     | RecordActions         | Implemented                                            |
| Activity          | Semantic ordered list                        | ActivityTimeline      | Implemented                                            |
| Shell             | Semantic navigation, PF controls             | AppShell              | Reference shell, not a routing framework               |
| Command search    | Modal and native links                       | AppShell              | Tab/Enter/Escape; no arrow-listbox claim               |
| Calendar          | DatePicker, TimePicker                       | Host DateField        | Contract only                                          |
| Feedback          | AlertGroup, Alert                            | Host FeedbackProvider | Contract only                                          |
| Upload            | MultipleFileUpload                           | Host DisclosureUpload | Picker validation demo; network workflow contract only |
| Chat              | PF ChatBot extension or approved composition | Host ChatWorkspace    | Contract only                                          |
| Preferences       | Switch, Select, Form                         | Host settings modules | Local example plus complete specification              |

Use public stable PatternFly exports, not deprecated/next subpaths. A PatternFly primitive alone does not implement authorisation, selection snapshots, view persistence or asynchronous recovery. Keep one shared owner per capability; no screen-local query builder, table toolbar or competing form footer.

## API boundaries

External actions are callbacks. Hosts own permissions, API errors and audit records. RecordTable's onExport receives fixture IDs; production query-wide export requires a snapshot and exclusions. onInspect must be guarded by the host. Inspector is modal: do not layer multiple editors casually. Confirmation focus must return through the modal stack.

New variants require a business name, state model, responsive behaviour, accessibility rules and tests. Stories should cover default, focus, disabled, busy, validation, loading, empty, slow, error, conflict, light/dark, narrow and long text. Contract-only entries must never be advertised as completed components.
