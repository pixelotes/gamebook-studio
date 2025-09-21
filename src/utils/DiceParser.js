// Advanced Dice Parser
class DiceParser {
  static parse(expression) {
    const cleanExpr = expression.replace(/\s/g, '').toLowerCase();
    const match = cleanExpr.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
    
    if (!match) {
      const num = parseInt(cleanExpr);
      if (!isNaN(num)) {
        return { count: 1, sides: num, modifier: 0, valid: true };
      }
      return { valid: false, error: 'Invalid dice expression' };
    }

    const count = parseInt(match[1] || '1');
    const sides = parseInt(match[2]);
    const modifierStr = match[3] || '+0';
    const modifier = parseInt(modifierStr);

    if (count > 100 || sides > 1000 || count < 1 || sides < 2) {
      return { valid: false, error: 'Invalid dice parameters' };
    }

    return { count: count, sides: sides, modifier: modifier, valid: true };
  }

  static roll(expression) {
    const parsed = this.parse(expression);
    if (!parsed.valid) {
      return { error: parsed.error };
    }

    const results = [];
    for (let i = 0; i < parsed.count; i++) {
      results.push(Math.floor(Math.random() * parsed.sides) + 1);
    }
    
    const diceTotal = results.reduce((sum, roll) => sum + roll, 0);
    const finalTotal = diceTotal + parsed.modifier;

    return {
      results: results,
      diceTotal: diceTotal,
      modifier: parsed.modifier,
      finalTotal: finalTotal,
      expression: `${parsed.count}d${parsed.sides}${parsed.modifier !== 0 ? (parsed.modifier > 0 ? '+' + parsed.modifier : parsed.modifier) : ''}`,
      breakdown: `(${results.join('+')})${parsed.modifier !== 0 ? ' ' + (parsed.modifier > 0 ? '+' : '') + parsed.modifier : ''} = ${finalTotal}`
    };
  }
}

export default DiceParser;