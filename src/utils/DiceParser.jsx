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

    // 2. Use a regular expression to split the string into terms.
    const termRegex = /([+-])(\d*cT|\d*dF|\d*d\d+|\d+)/gi;
    const terms = Array.from(cleanExpr.matchAll(termRegex));

    if (!terms || terms.length === 0) {
      return { error: 'Invalid dice expression' };
    }

    let finalTotal = 0;
    const allIndividualRolls = [];
    const breakdownParts = [];
    let isFateRoll = false;
    let isCoinToss = false;
    let coinTossSummary = '';

    // 3. Process each term individually.
    for (const term of terms) {
      const sign = term[1] === '-' ? -1 : 1;
      const value = term[2];

      if (value.toLowerCase().includes('ct')) {
        isCoinToss = true;
        const [countStr] = value.toLowerCase().split('ct');
        const count = countStr === '' ? 1 : parseInt(countStr);

        if (isNaN(count) || count < 1 || count > 100) {
            return { error: `Invalid coin toss count: ${value}` };
        }

        const termSymbols = [];
        let headsCount = 0;
        let tailsCount = 0;
        for (let i = 0; i < count; i++) {
            if (Math.random() < 0.5) {
                termSymbols.push('Heads');
                headsCount++;
            } else {
                termSymbols.push('Tails');
                tailsCount++;
            }
        }
        
        // Create the summary text
        if (count === 1) {
            coinTossSummary = termSymbols[0];
        } else {
            const parts = [];
            if (headsCount > 0) parts.push(`${headsCount} Heads`);
            if (tailsCount > 0) parts.push(`${tailsCount} Tails`);
            coinTossSummary = parts.join(', ');
        }
        
        finalTotal += headsCount * sign;
        breakdownParts.push({ text: `(${termSymbols.join(', ')})`, symbols: termSymbols, isFate: false });

      } else if (value.toLowerCase().includes('df')) {
        isFateRoll = true;
        const [countStr] = value.toLowerCase().split('d');
        const count = countStr === '' ? 1 : parseInt(countStr);

        if (isNaN(count) || count < 1 || count > 100) {
          return { error: `Invalid Fate dice count: ${value}` };
        }

        const termRolls = [];
        const termSymbols = [];
        let termTotal = 0;
        for (let i = 0; i < count; i++) {
          const roll = Math.floor(Math.random() * 3) - 1;
          termRolls.push(roll);
          termTotal += roll;
          if (roll === 1) termSymbols.push('[+]');
          else if (roll === -1) termSymbols.push('[-]');
          else termSymbols.push('[]');
        }

        allIndividualRolls.push(...termRolls);
        finalTotal += termTotal * sign;
        breakdownParts.push({ sign: term[1], text: `(${termSymbols.join(' ')})`, symbols: termSymbols.map(s => s.replace(/[\[\]]/g, '')), isFate: true });

      } else if (value.includes('d')) {
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
        breakdownParts.push({ sign: term[1], text: `(${termRolls.join('+')})`, isFate: false });

      } else {
        const modifier = parseInt(value);
        if (isNaN(modifier)) {
          return { error: `Invalid modifier: ${value}` };
        }
        finalTotal += modifier * sign;
        breakdownParts.push({ sign: term[1], text: `${modifier}`, isFate: false });
      }
    }

    const breakdown = breakdownParts.map(p => `${p.sign || ''} ${p.text}`).join(' ').replace(/^[+] /, '');
    
    const symbolicBreakdown = isFateRoll || isCoinToss ? breakdownParts.flatMap(p => p.symbols || []) : null;

    let type = 'standard';
    if (isCoinToss) type = 'coin';
    else if (isFateRoll) type = 'fate';

    return {
      finalTotal: isCoinToss ? coinTossSummary : finalTotal,
      results: allIndividualRolls,
      breakdown: `${breakdown} = ${isCoinToss ? coinTossSummary : finalTotal}`,
      symbolicBreakdown: symbolicBreakdown,
      expression: expression,
      type: type,
    };
  }
}

export default DiceParser;