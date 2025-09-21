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
    // 1. Clean up the expression and ensure it starts with a sign for easier parsing.
    let cleanExpr = expression.replace(/\s/g, '');
    if (!cleanExpr.startsWith('+') && !cleanExpr.startsWith('-')) {
      cleanExpr = '+' + cleanExpr;
    }

    // 2. Use a regular expression to split the string into terms (e.g., '+2d6', '+1d8', '+2').
    const termRegex = /([+-])(\d*d\d+|\d+)/g;
    const terms = Array.from(cleanExpr.matchAll(termRegex));

    if (!terms || terms.length === 0) {
      return { error: 'Invalid dice expression' };
    }

    let finalTotal = 0;
    const allIndividualRolls = [];
    const breakdownParts = [];

    // 3. Process each term individually.
    for (const term of terms) {
      const sign = term[1] === '-' ? -1 : 1;
      const value = term[2];

      if (value.includes('d')) {
        // It's a dice term (e.g., '2d6')
        const [countStr, sidesStr] = value.split('d');
        const count = countStr === '' ? 1 : parseInt(countStr);
        const sides = parseInt(sidesStr);

        if (isNaN(count) || isNaN(sides) || count < 1 || sides < 1 || count > 100 || sides > 1000) {
          return { error: `Invalid dice term: ${value}` };
        }

        const termRolls = [];
        let termTotal = 0;
        for (let i = 0; i < count; i++) {
          const roll = Math.floor(Math.random() * sides) + 1;
          termRolls.push(roll);
          termTotal += roll;
        }

        allIndividualRolls.push(...termRolls);
        finalTotal += termTotal * sign;
        breakdownParts.push({ sign: term[1], text: `(${termRolls.join('+')})` });

      } else {
        // It's a simple number modifier (e.g., '2')
        const modifier = parseInt(value);
        if (isNaN(modifier)) {
          return { error: `Invalid modifier: ${value}` };
        }
        finalTotal += modifier * sign;
        breakdownParts.push({ sign: term[1], text: `${modifier}` });
      }
    }

    // 4. Build a detailed breakdown string for the user.
    const breakdown = breakdownParts.map(p => `${p.sign} ${p.text}`).join(' ').replace(/^[+] /, '');

    return {
      finalTotal: finalTotal,
      results: allIndividualRolls,
      breakdown: `${breakdown} = ${finalTotal}`,
      expression: expression,
    };
  }
}

export default DiceParser;