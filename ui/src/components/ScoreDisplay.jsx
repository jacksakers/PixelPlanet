/**
 * ScoreDisplay.jsx
 *
 * Overlay HUD that shows the current game score while a game is active.
 * Also displays a "Game Over" screen when the game has ended.
 *
 * Props:
 *   score      - number   (current score)
 *   gameState  - number   (0=idle, 1=active, 2=ended)
 *   onRestart  - () => void  (called when user clicks Restart)
 */

const S = {
  // Score badge shown during active game
  badge: {
    position: 'absolute',
    top: 48,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(13,13,18,0.80)',
    border: '1px solid #3a3a55',
    borderRadius: 10,
    padding: '4px 18px',
    fontSize: '1.1rem',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    color: '#aaccff',
    letterSpacing: '0.04em',
    pointerEvents: 'none',
    zIndex: 30,
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  // Full-screen overlay for game over
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    gap: 20,
    userSelect: 'none',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 800,
    color: '#eef',
    letterSpacing: '0.08em',
  },
  scoreText: {
    fontSize: '3rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    color: '#aaccff',
  },
  label: {
    fontSize: '0.9rem',
    color: '#778',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  restartBtn: {
    marginTop: 8,
    padding: '10px 32px',
    background: '#2a3a5a',
    border: '1px solid #4466aa',
    borderRadius: 8,
    color: '#aaccff',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
  },
};

export default function ScoreDisplay({ score, gameState, onRestart }) {
  if (gameState === 0) return null;

  if (gameState === 2) {
    return (
      <div style={S.overlay}>
        <span style={S.title}>GAME OVER</span>
        <span style={S.label}>Final Score</span>
        <span style={S.scoreText}>{score.toLocaleString()}</span>
        <button style={S.restartBtn} onClick={onRestart}>Restart</button>
      </div>
    );
  }

  // gameState === 1 — active
  return (
    <div style={S.badge}>
      ⭐ {score.toLocaleString()}
    </div>
  );
}
