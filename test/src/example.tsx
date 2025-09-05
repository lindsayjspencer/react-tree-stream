import React from 'react';
import { TreeStream } from 'react-tree-stream';

export function Demo() {
	return (
		<TreeStream as="div">
			Hello <TreeStream as="b">world</TreeStream>
		</TreeStream>
	);
}
