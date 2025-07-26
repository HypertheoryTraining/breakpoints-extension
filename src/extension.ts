// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "class-breakpoint" is now active!');

	// Register the new breakpoint command
	const newBreakpointDisposable = vscode.commands.registerCommand('class-breakpoint.newBreakpoint', async (uri: vscode.Uri) => {
		// The uri parameter contains the folder that was right-clicked
		const folderPath = uri.fsPath;
		
		// Prompt user for breakpoint name
		const breakpointName = await vscode.window.showInputBox({
			prompt: 'Enter a name for the breakpoint',
			placeHolder: 'Breakpoint name...',
			validateInput: (value: string) => {
				if (!value || value.trim() === '') {
					return 'Breakpoint name cannot be empty';
				}
				return null;
			}
		});
		
		// Check if user cancelled the input
		if (breakpointName === undefined) {
			return; // User cancelled
		}
		
		try {
			// Get the workspace root
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}
			
			const workspaceRoot = workspaceFolder.uri.fsPath;
			
			// Check if this is a Git repository and perform Git operations
			if (await isGitRepository(workspaceRoot)) {
				try {
					await performGitOperations(workspaceRoot, breakpointName);
					vscode.window.showInformationMessage(`Created Git branch "${breakpointName}"`);
				} catch (gitError: any) {
					vscode.window.showWarningMessage(`Git operations failed: ${gitError.message}`);
					// Continue with breakpoint creation even if Git fails
				}
			}
			
			const breakpointsDir = path.join(workspaceRoot, 'breakpoints');
			const breakpointDir = path.join(breakpointsDir, breakpointName);
			const targetDir = path.join(breakpointDir, '01-initial');
			
			// Create breakpoints directory if it doesn't exist
			if (!fs.existsSync(breakpointsDir)) {
				fs.mkdirSync(breakpointsDir, { recursive: true });
			}
			
			// Check if breakpoint directory already exists
			if (fs.existsSync(breakpointDir)) {
				const overwrite = await vscode.window.showWarningMessage(
					`Breakpoint "${breakpointName}" already exists. Overwrite?`,
					'Yes', 'No'
				);
				if (overwrite !== 'Yes') {
					return;
				}
				// Remove existing directory
				fs.rmSync(breakpointDir, { recursive: true, force: true });
			}
			
			// Copy the folder content
			await copyFolder(folderPath, targetDir);
			
			// If in Git repository, add and commit the breakpoint files
			if (await isGitRepository(workspaceRoot)) {
				try {
					await executeGitCommand('git add .', workspaceRoot);
					await executeGitCommand('git commit -m "created breakpoint"', workspaceRoot);
				} catch (gitError: any) {
					vscode.window.showWarningMessage(`Failed to commit breakpoint: ${gitError.message}`);
				}
			}
			
			// Show success message
			vscode.window.showInformationMessage(`Created breakpoint "${breakpointName}" successfully!`);
			
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create breakpoint: ${error}`);
		}
	});

	// Register the add step command
	const addStepDisposable = vscode.commands.registerCommand('class-breakpoint.addStep', async () => {
		try {
			// Get the workspace root
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}

			const workspaceRoot = workspaceFolder.uri.fsPath;
			const breakpointsDir = path.join(workspaceRoot, 'breakpoints');
			
			// Check if breakpoints directory exists
			if (!fs.existsSync(breakpointsDir)) {
				vscode.window.showErrorMessage('No breakpoints folder found. Create a breakpoint first.');
				return;
			}
			
			// Find all breakpoint directories
			const breakpointDirs = fs.readdirSync(breakpointsDir)
				.filter(item => fs.statSync(path.join(breakpointsDir, item)).isDirectory());
			
			if (breakpointDirs.length === 0) {
				vscode.window.showErrorMessage('No breakpoints found. Create a breakpoint first.');
				return;
			}
			
			// Let user select which breakpoint to add step to
			let selectedBreakpoint: string;
			if (breakpointDirs.length === 1) {
				selectedBreakpoint = breakpointDirs[0];
			} else {
				const selection = await vscode.window.showQuickPick(breakpointDirs, {
					placeHolder: 'Select a breakpoint to add step to'
				});
				if (!selection) {
					return; // User cancelled
				}
				selectedBreakpoint = selection;
			}
			
			const breakpointDir = path.join(breakpointsDir, selectedBreakpoint);
			
			// Find the next step number by looking at existing folders
			const existingSteps = fs.readdirSync(breakpointDir)
				.filter(item => fs.statSync(path.join(breakpointDir, item)).isDirectory())
				.filter(item => /^\d{2}-/.test(item)) // Folders starting with two digits and a dash
				.map(item => parseInt(item.substring(0, 2)))
				.sort((a, b) => a - b);
			
			const nextStepNumber = existingSteps.length > 0 ? Math.max(...existingSteps) + 1 : 2;
			const stepNumberStr = nextStepNumber.toString().padStart(2, '0');
			
			// Prompt user for step name
			const stepName = await vscode.window.showInputBox({
				prompt: 'Enter a name for the step',
				placeHolder: 'Step name...',
				validateInput: (value: string) => {
					if (!value || value.trim() === '') {
						return 'Step name cannot be empty';
					}
					return null;
				}
			});
			
			// Check if user cancelled the input
			if (stepName === undefined) {
				return; // User cancelled
			}
			
			const stepFolderName = `${stepNumberStr}-${stepName}`;
			const targetDir = path.join(breakpointDir, stepFolderName);
			
			// Check if step already exists
			if (fs.existsSync(targetDir)) {
				vscode.window.showErrorMessage(`Step "${stepFolderName}" already exists in breakpoint "${selectedBreakpoint}".`);
				return;
			}
			
			// Copy the folder content
			if (await isGitRepository(workspaceRoot)) {
				// In a Git repository - first commit any pending changes, then copy only changed files
				try {
					// Check if there are uncommitted changes and commit them first
					if (await hasUncommittedChanges(workspaceRoot)) {
						await executeGitCommand('git add .', workspaceRoot);
						await executeGitCommand(`git commit -m "Auto-commit changes before creating step ${stepFolderName}"`, workspaceRoot);
						vscode.window.showInformationMessage('Committed pending changes before creating step');
					}
					
					// Now copy the files that were just committed
					await copyChangedFiles(workspaceRoot, targetDir);
				} catch (gitError: any) {
					vscode.window.showWarningMessage(`Git operations failed: ${gitError.message}. Creating empty step folder.`);
					// Create empty folder if Git operations fail
					fs.mkdirSync(targetDir, { recursive: true });
				}
			} else {
				// Not in Git repository - inform user that this command requires Git
				vscode.window.showErrorMessage('Add Step command requires a Git repository to track changes. Use New Breakpoint instead for non-Git projects.');
				return;
			}
			
			// If in Git repository, commit the step, merge to main, and switch back
			if (await isGitRepository(workspaceRoot)) {
				try {
					// Add and commit the new step
					await executeGitCommand('git add .', workspaceRoot);
					await executeGitCommand(`git commit -m "${stepFolderName}"`, workspaceRoot);
					
					// Switch to main branch
					await executeGitCommand('git checkout main', workspaceRoot);
					
					// Merge the breakpoint branch
					await executeGitCommand(`git merge ${selectedBreakpoint}`, workspaceRoot);
					
					// Switch back to the breakpoint branch
					await executeGitCommand(`git checkout ${selectedBreakpoint}`, workspaceRoot);
					
					vscode.window.showInformationMessage(`Git operations completed: committed "${stepFolderName}", merged to main, and returned to "${selectedBreakpoint}" branch`);
				} catch (gitError: any) {
					vscode.window.showWarningMessage(`Git operations failed: ${gitError.message}`);
				}
			}
			
			// Show success message
			vscode.window.showInformationMessage(`Added step "${stepFolderName}" to breakpoint "${selectedBreakpoint}" successfully!`);
			
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to add step: ${error}`);
		}
	});

	// Register the push main command
	const pushMainDisposable = vscode.commands.registerCommand('class-breakpoint.pushMain', async () => {
		try {
			// Get the workspace root
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}
			
			const workspaceRoot = workspaceFolder.uri.fsPath;
			
			// Check if this is a Git repository
			if (!(await isGitRepository(workspaceRoot))) {
				vscode.window.showErrorMessage('Not a Git repository');
				return;
			}
			
			try {
				// Get current branch to switch back to later
				const currentBranch = await executeGitCommand('git branch --show-current', workspaceRoot);
				
				// Switch to main branch
				await executeGitCommand('git checkout main', workspaceRoot);
				
				// Push main branch to origin
				await executeGitCommand('git push origin main', workspaceRoot);
				
				// Switch back to the original branch if it wasn't main
				if (currentBranch !== 'main') {
					await executeGitCommand(`git checkout ${currentBranch}`, workspaceRoot);
					vscode.window.showInformationMessage(`Pushed main to origin and returned to "${currentBranch}" branch`);
				} else {
					vscode.window.showInformationMessage('Pushed main to origin successfully');
				}
				
			} catch (gitError: any) {
				vscode.window.showErrorMessage(`Failed to push main: ${gitError.message}`);
			}
			
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to push main: ${error}`);
		}
	});

	// Register the finish breakpoint command
	const finishBreakpointDisposable = vscode.commands.registerCommand('class-breakpoint.finishBreakpoint', async () => {
		try {
			// Get the workspace root
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}

			const workspaceRoot = workspaceFolder.uri.fsPath;
			const breakpointsDir = path.join(workspaceRoot, 'breakpoints');
			
			// Check if breakpoints directory exists
			if (!fs.existsSync(breakpointsDir)) {
				vscode.window.showErrorMessage('No breakpoints folder found. Create a breakpoint first.');
				return;
			}
			
			// Find all breakpoint directories
			const breakpointDirs = fs.readdirSync(breakpointsDir)
				.filter(item => fs.statSync(path.join(breakpointsDir, item)).isDirectory());
			
			if (breakpointDirs.length === 0) {
				vscode.window.showErrorMessage('No breakpoints found. Create a breakpoint first.');
				return;
			}
			
			// Let user select which breakpoint to finish
			let selectedBreakpoint: string;
			if (breakpointDirs.length === 1) {
				selectedBreakpoint = breakpointDirs[0];
			} else {
				const selection = await vscode.window.showQuickPick(breakpointDirs, {
					placeHolder: 'Select a breakpoint to finish'
				});
				if (!selection) {
					return; // User cancelled
				}
				selectedBreakpoint = selection;
			}
			
			const breakpointDir = path.join(breakpointsDir, selectedBreakpoint);
			
			// Generate the change log
			await generateChangeLog(workspaceRoot, breakpointDir, selectedBreakpoint);
			
			vscode.window.showInformationMessage(`Generated change-log.md for breakpoint "${selectedBreakpoint}"`);
			
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to finish breakpoint: ${error}`);
		}
	});

	// Helper function to generate change log
	async function generateChangeLog(workspaceRoot: string, breakpointDir: string, breakpointName: string): Promise<void> {
		try {
			// Get all step directories
			const stepDirs = fs.readdirSync(breakpointDir)
				.filter(item => fs.statSync(path.join(breakpointDir, item)).isDirectory())
				.filter(item => /^\d{2}-/.test(item)) // Folders starting with two digits and a dash
				.sort(); // Sort alphabetically (which will be chronological due to numbering)
			
			let changeLogContent = `# ${breakpointName} - Change Log\n\n`;
			changeLogContent += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
			changeLogContent += `## Overview\n\nThis document summarizes the changes made in each step of the "${breakpointName}" breakpoint.\n\n`;
			
			// Check if we're in a Git repository for detailed analysis
			const isGitRepo = await isGitRepository(workspaceRoot);
			
			for (let i = 0; i < stepDirs.length; i++) {
				const stepDir = stepDirs[i];
				const stepPath = path.join(breakpointDir, stepDir);
				
				changeLogContent += `## ${stepDir}\n\n`;
				
				// Get list of files in this step
				const files = await getFilesRecursively(stepPath);
				
				if (files.length === 0) {
					changeLogContent += `*No files in this step.*\n\n`;
					continue;
				}
				
				changeLogContent += `### Files Modified (${files.length} files)\n\n`;
				
				// Group files by type/directory
				const filesByDir = new Map<string, string[]>();
				files.forEach(file => {
					const relativeFile = path.relative(stepPath, file);
					const dir = path.dirname(relativeFile);
					const dirKey = dir === '.' ? 'Root' : dir;
					
					if (!filesByDir.has(dirKey)) {
						filesByDir.set(dirKey, []);
					}
					filesByDir.get(dirKey)!.push(path.basename(relativeFile));
				});
				
				// Output files organized by directory
				for (const [dir, fileList] of Array.from(filesByDir.entries()).sort()) {
					if (dir !== 'Root') {
						changeLogContent += `#### ${dir}/\n`;
					}
					
					fileList.sort().forEach(file => {
						changeLogContent += `- ${file}\n`;
					});
					changeLogContent += '\n';
				}
				
				// If it's the initial step, note that
				if (stepDir.includes('01-initial')) {
					changeLogContent += `*This is the initial state of the project.*\n\n`;
				} else {
					changeLogContent += `*This step contains the changes for: ${stepDir.substring(3).replace(/-/g, ' ')}*\n\n`;
				}
			}
			
			// Add summary section
			changeLogContent += `## Summary\n\n`;
			changeLogContent += `- **Total Steps**: ${stepDirs.length}\n`;
			changeLogContent += `- **Breakpoint**: ${breakpointName}\n`;
			if (isGitRepo) {
				changeLogContent += `- **Git Integration**: Enabled\n`;
			}
			changeLogContent += `\n---\n\n`;
			changeLogContent += `*Generated by BreakPoint VS Code Extension*\n`;
			
			// Write the change log file
			const changeLogPath = path.join(breakpointDir, 'change-log.md');
			fs.writeFileSync(changeLogPath, changeLogContent, 'utf8');
			
			// Open the file in VS Code
			const doc = await vscode.workspace.openTextDocument(changeLogPath);
			await vscode.window.showTextDocument(doc);
			
		} catch (error: any) {
			throw new Error(`Failed to generate change log: ${error.message}`);
		}
	}
	
	// Helper function to get all files recursively
	async function getFilesRecursively(dir: string): Promise<string[]> {
		const files: string[] = [];
		
		const items = fs.readdirSync(dir);
		for (const item of items) {
			const fullPath = path.join(dir, item);
			const stat = fs.statSync(fullPath);
			
			if (stat.isDirectory()) {
				const subFiles = await getFilesRecursively(fullPath);
				files.push(...subFiles);
			} else {
				files.push(fullPath);
			}
		}
		
		return files;
	}

	// Helper function to copy folder recursively
	async function copyFolder(source: string, destination: string): Promise<void> {
		// Create destination directory
		fs.mkdirSync(destination, { recursive: true });
		
		// Read source directory
		const items = fs.readdirSync(source);
		
		for (const item of items) {
			const sourcePath = path.join(source, item);
			const destPath = path.join(destination, item);
			const stat = fs.statSync(sourcePath);
			
			if (stat.isDirectory()) {
				// Recursively copy subdirectory
				await copyFolder(sourcePath, destPath);
			} else {
				// Copy file
				fs.copyFileSync(sourcePath, destPath);
			}
		}
	}

	// Helper function to copy only changed files since last commit
	async function copyChangedFiles(workspaceRoot: string, destination: string): Promise<void> {
		try {
			// Get list of changed files between the current commit and the previous commit
			const changedFilesOutput = await executeGitCommand('git diff --name-only HEAD~1 HEAD', workspaceRoot);
			
			// Split and filter the files
			const changedFiles = changedFilesOutput.split('\n').filter(f => f.trim());
			
			if (changedFiles.length === 0) {
				vscode.window.showWarningMessage('No changed files found in the last commit. Creating empty step folder.');
				fs.mkdirSync(destination, { recursive: true });
				return;
			}
			
			// Create destination directory
			fs.mkdirSync(destination, { recursive: true });
			
			// Copy each changed file
			for (const relativeFilePath of changedFiles) {
				const sourcePath = path.join(workspaceRoot, relativeFilePath);
				const destPath = path.join(destination, relativeFilePath);
				
				// Check if source file exists (it might have been deleted)
				if (fs.existsSync(sourcePath)) {
					// Create directory structure if needed
					const destDir = path.dirname(destPath);
					fs.mkdirSync(destDir, { recursive: true });
					
					// Copy the file
					fs.copyFileSync(sourcePath, destPath);
				}
			}
			
			vscode.window.showInformationMessage(`Copied ${changedFiles.length} changed file(s) from last commit to step folder`);
			
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to get changed files: ${error.message}`);
			throw error;
		}
	}

	// Helper function to execute git commands
	const execAsync = promisify(exec);
	
	async function executeGitCommand(command: string, cwd: string): Promise<string> {
		try {
			const { stdout } = await execAsync(command, { cwd });
			return stdout.trim();
		} catch (error: any) {
			throw new Error(`Git command failed: ${error.message}`);
		}
	}
	
	async function isGitRepository(workspaceRoot: string): Promise<boolean> {
		try {
			await executeGitCommand('git rev-parse --git-dir', workspaceRoot);
			return true;
		} catch {
			return false;
		}
	}
	
	async function hasUncommittedChanges(workspaceRoot: string): Promise<boolean> {
		try {
			const status = await executeGitCommand('git status --porcelain', workspaceRoot);
			return status.length > 0;
		} catch {
			return false;
		}
	}
	
	async function performGitOperations(workspaceRoot: string, breakpointName: string): Promise<void> {
		// Check if there are uncommitted changes and commit them
		if (await hasUncommittedChanges(workspaceRoot)) {
			await executeGitCommand('git add .', workspaceRoot);
			await executeGitCommand('git commit -m "Auto-commit before creating breakpoint"', workspaceRoot);
		}
		
		// Create and checkout new branch
		await executeGitCommand(`git checkout -b ${breakpointName}`, workspaceRoot);
	}

	context.subscriptions.push(newBreakpointDisposable);
	context.subscriptions.push(addStepDisposable);
	context.subscriptions.push(pushMainDisposable);
	context.subscriptions.push(finishBreakpointDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
