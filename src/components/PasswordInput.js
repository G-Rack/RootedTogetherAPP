import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';

// A password TextInput with a tap-to-reveal eye toggle, shared by the
// sign-up form, the login screen, and the forgot-password screen so all
// three look and behave identically.
//
// textContentType is deliberately "oneTimeCode" here, not "password" or
// "newPassword" — this isn't a stylistic choice, it's a workaround for a
// long-standing iOS + React Native bug (tracked upstream at
// facebook/react-native#21911 and react/react-native#49933/#49932): any
// secureTextEntry field flagged as a password/newPassword field can
// trigger iOS's "Strong Password" AutoFill engine, which paints a pale
// yellow "I'll remember this" highlight — and that highlight can land on
// the WRONG field (an unrelated one nearby) due to a positioning bug in
// how the suggestion popover is placed over React Native's view
// hierarchy, occasionally leaving that field stuck and unresponsive. Real
// devices are affected even when other fields on the same screen are
// correctly marked textContentType="none". The one fix that reliably
// stops it at the source, confirmed across multiple reports, is not
// giving iOS a password-shaped field to react to in the first place:
// "oneTimeCode" is the value the community has landed on for this. The
// trade-off is real — none of these fields will trigger iOS's "save to
// Keychain" prompt for now — but a password field that's occasionally
// unresponsive is a worse experience than losing that one convenience.
export default function PasswordInput({
  value,
  onChangeText,
  textContentType = 'oneTimeCode',
  placeholder,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={textContentType}
      />
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible((v) => !v)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textSoft} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  input: {
    fontSize: 15,
    padding: 13,
    paddingRight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.25)',
    backgroundColor: colors.white,
    color: colors.text,
  },
  toggle: { position: 'absolute', right: 8, height: '100%', justifyContent: 'center', paddingHorizontal: 8 },
});
