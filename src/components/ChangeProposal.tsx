'use client';

import React from 'react';

interface ProposedChange {
  function: string;
  arguments: Record<string, any>;
  spaceId: string;
}

interface ChangeProposalProps {
  proposal: ProposedChange;
  onApprove: () => void;
  onReject: () => void;
  isExecuting?: boolean;
  hideButtons?: boolean;
}

export const ChangeProposal: React.FC<ChangeProposalProps> = ({
  proposal,
  onApprove,
  onReject,
  isExecuting = false,
  hideButtons = false,
}) => {
  const renderProposal = () => {
    switch (proposal.function) {
      case 'add_node':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Add New Node</h4>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-gray-500 dark:text-gray-400">ID:</span>{' '}
                <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">
                  {proposal.arguments.id}
                </code>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Meaning:</span>{' '}
                {proposal.arguments.meaning}
              </div>
              {proposal.arguments.focus !== undefined && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Focus:</span>{' '}
                  {proposal.arguments.focus} {proposal.arguments.focus === 1 ? '(visible)' : proposal.arguments.focus === -1 ? '(hidden)' : '(neutral)'}
                </div>
              )}
              {proposal.arguments.position !== undefined && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Position:</span>{' '}
                  {proposal.arguments.position}
                </div>
              )}
            </div>
          </div>
        );

      case 'add_relationship':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Add Relationship</h4>
            <div className="text-xs space-y-1">
              <div className="font-mono">
                {proposal.arguments.sourceNode} →{' '}
                <span className={
                  proposal.arguments.type === 'supports' ? 'text-blue-600 dark:text-blue-400' :
                  proposal.arguments.type === 'conflicts-with' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-600 dark:text-gray-400'
                }>
                  {proposal.arguments.type}
                </span>{' '}
                → {proposal.arguments.targetNode}
              </div>
              {proposal.arguments.strength !== undefined && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Strength:</span>{' '}
                  {proposal.arguments.strength}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm">
            <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
              {proposal.function}
            </code>
            <pre className="mt-2 text-xs overflow-x-auto">
              {JSON.stringify(proposal.arguments, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className={hideButtons ? "border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800" : "border-2 border-blue-500 dark:border-blue-400 rounded-lg p-3 mb-4 bg-blue-50 dark:bg-blue-900/20"}>
      <div className={hideButtons ? "" : "flex items-start gap-2 mb-3"}>
        {!hideButtons && (
          <div className="text-blue-600 dark:text-blue-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        )}
        <div className="flex-1">
          {!hideButtons && (
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Proposed Change
            </h3>
          )}
          {renderProposal()}
        </div>
      </div>

      {!hideButtons && (
        <div className="flex gap-2 justify-end">
          <button
            onClick={onReject}
            disabled={isExecuting}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={isExecuting}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? 'Executing...' : 'Approve & Execute'}
          </button>
        </div>
      )}
    </div>
  );
};
