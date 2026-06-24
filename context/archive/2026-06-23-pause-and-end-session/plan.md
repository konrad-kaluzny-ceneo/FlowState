# B-09 Pause and end session — plan

## Phase 1: Copy + confirm variant

- `getEndSessionConfirmCopy(variant)` with `after-pause` strings
- `EndSessionConfirmOverlay` accepts `variant`

### Automated

- [x] 1.1 copy + overlay unit tests

## Phase 2: Dashboard dual-action

- `Pause & end session` when running → `pause()` then after-pause confirm
- `End session` unchanged (immediate confirm while running/paused)

### Automated

- [x] 2.1 `pnpm check` + `pnpm test`

## Phase 3: Belt e2e

- session-closure: pause-and-end path

### Automated

- [x] 3.1 e2e session-closure pause-and-end case

## Progress

### Phase 1

#### Automated

- [x] 1.1 copy + overlay unit tests

### Phase 2

#### Automated

- [x] 2.1 `pnpm check` + `pnpm test`

### Phase 3

#### Automated

- [x] 3.1 e2e session-closure pause-and-end case
