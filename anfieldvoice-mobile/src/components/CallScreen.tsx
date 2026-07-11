// ============================================================================
// AnfieldVoice — Call Screen (Slice 2)
// Full-screen active call UI with timer, mute, speaker, and end call
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';
import type { CallState } from '../hooks/useWebRTC';

interface CallScreenProps {
  callState: CallState;
  callerUnit: string;
  durationSecs: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  onDismiss?: () => void;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallScreen({
  callState,
  callerUnit,
  durationSecs,
  isMuted,
  isSpeakerOn,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
  onDismiss,
}: CallScreenProps) {
  const isActive = callState === 'connected' || callState === 'ringing' || callState === 'calling';

  if (!isActive && callState !== 'ended') return null;

  return (
    <View style={styles.container}>
      {/* Status area */}
      <View style={styles.statusArea}>
        <View style={styles.avatar}>
          <Ionicons
            name={callState === 'ended' ? 'call' : 'call'}
            size={48}
            color={callState === 'ended' ? Colors.textSecondary : Colors.success}
          />
        </View>

        <Text style={styles.unit}>{callerUnit}</Text>

        <Text style={styles.state}>
          {callState === 'calling' ? 'Connecting...' :
           callState === 'ringing' ? 'Ringing...' :
           callState === 'connected' ? formatDuration(durationSecs) :
           callState === 'ended' ? 'Call Ended' : ''}
        </Text>
      </View>

      {/* Controls */}
      {callState !== 'ended' && (
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <ControlButton
              icon={isMuted ? 'mic-off' : 'mic'}
              label={isMuted ? 'Unmute' : 'Mute'}
              color={isMuted ? Colors.warning : Colors.text}
              bgColor={isMuted ? Colors.warning + '20' : Colors.bgElevated}
              onPress={onToggleMute}
            />
            <ControlButton
              icon={isSpeakerOn ? 'volume-high' : 'volume-medium'}
              label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
              color={isSpeakerOn ? Colors.primary : Colors.text}
              bgColor={isSpeakerOn ? Colors.primary + '20' : Colors.bgElevated}
              onPress={onToggleSpeaker}
            />
          </View>

          <TouchableOpacity style={styles.endCallBtn} onPress={onEndCall} activeOpacity={0.8}>
            <Ionicons name="call" size={36} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Dismiss for ended state */}
      {callState === 'ended' && onDismiss && (
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ControlButton({
  icon,
  label,
  color,
  bgColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.controlBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.controlIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={[styles.controlLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
    zIndex: 200,
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: Spacing.xxl,
  },
  statusArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 3,
    borderColor: Colors.border,
  },
  unit: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  state: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '500',
  },
  controls: {
    alignItems: 'center',
    gap: Spacing.xxl,
  },
  controlRow: {
    flexDirection: 'row',
    gap: Spacing.xxxl,
  },
  controlBtn: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  controlIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  endCallBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  } as Record<string, unknown>,
  dismissBtn: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  dismissText: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
});
