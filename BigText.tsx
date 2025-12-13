import React from 'react';
import { Box, Text, type BoxProps } from 'ink';
import tinyFont from './tiny.json';

interface FontData {
    lines: number;
    letterspace: string[];
    chars: Record<string, string[]>;
}

const fontData = tinyFont as FontData;

const renderTinyText = (text: string): string => {
    const { lines, letterspace, chars } = fontData;
    let result = '';

    for (let line = 0; line < lines; line++) {
        for (let i = 0; i < text.length; i++) {
            // @ts-ignore
            const char = text[i].toUpperCase(); 
            const charData = chars[char] || chars[' '];

            if (charData && charData[line]) {
                result += charData[line];
            }
            
            if (i < text.length - 1 && letterspace[line]) {
                result += letterspace[line];
            }
        }
        
        if (line < lines - 1) {
            result += '\n';
        }
    }

    return result;
};

interface BigTextProps extends BoxProps {
    text: string;
    font?: string;
    colors?: string[];
}

const BigText: React.FC<BigTextProps> = ({ text, font, colors, ...props }) => {
    const activeColor = colors && colors.length > 0 ? colors[0] : undefined;

    if (font === 'tiny') {
        const asciiArt = renderTinyText(text);
        return (
            <Box paddingX={1} paddingY={2} {...props}>
                <Text color={activeColor}>
                    {asciiArt}
                </Text>
            </Box>
        );
    }

    return (
        <Text color={activeColor} {...props}>
            {text}
        </Text>
    );
};

export default BigText;