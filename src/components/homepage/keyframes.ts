// Global keyframes injected once by the composed homepage.
// Kept as a string so we can `dangerouslySetInnerHTML` into a <style>
// without pulling in a runtime CSS-in-JS layer.

export const CONSTRUCTION_KEYFRAMES = `
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-8px); }
}
`;
