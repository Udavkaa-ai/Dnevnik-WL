import React from 'react';
import { View, Text } from 'react-native';

// Renders inline **bold** and *italic* within a line
function InlineText({ text, baseStyle, boldStyle, italicStyle }) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={key++} style={baseStyle}>{text.slice(last, match.index)}</Text>);
    }
    if (match[2] !== undefined) {
      parts.push(<Text key={key++} style={[baseStyle, boldStyle]}>{match[2]}</Text>);
    } else if (match[3] !== undefined) {
      parts.push(<Text key={key++} style={[baseStyle, italicStyle]}>{match[3]}</Text>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(<Text key={key++} style={baseStyle}>{text.slice(last)}</Text>);
  }
  return <Text style={baseStyle}>{parts}</Text>;
}

export default function MarkdownText({ text, style }) {
  if (!text) return null;

  const baseStyle = style || {};
  const boldStyle = { fontWeight: 'bold' };
  const italicStyle = { fontStyle: 'italic' };
  const lines = text.split('\n');

  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      elements.push(<View key={key++} style={{ height: 6 }} />);
      continue;
    }

    // Heading: ### or ## or #
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizes = [20, 17, 15];
      const headStyle = [baseStyle, { fontWeight: 'bold', fontSize: sizes[level - 1] || 15, marginTop: 4 }];
      elements.push(
        <InlineText key={key++} text={headingMatch[2]} baseStyle={headStyle} boldStyle={boldStyle} italicStyle={italicStyle} />
      );
      continue;
    }

    // Bullet: * or - or •
    const bulletMatch = trimmed.match(/^([*\-•])\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <View key={key++} style={{ flexDirection: 'row', marginTop: 2 }}>
          <Text style={[baseStyle, { marginRight: 6 }]}>•</Text>
          <View style={{ flex: 1 }}>
            <InlineText text={bulletMatch[2]} baseStyle={baseStyle} boldStyle={boldStyle} italicStyle={italicStyle} />
          </View>
        </View>
      );
      continue;
    }

    // Normal line
    elements.push(
      <InlineText key={key++} text={trimmed} baseStyle={[baseStyle, { marginTop: 2 }]} boldStyle={boldStyle} italicStyle={italicStyle} />
    );
  }

  return <View>{elements}</View>;
}
