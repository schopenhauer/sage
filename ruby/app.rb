require 'serialport'
require 'openssl'
require 'dotenv'
Dotenv.load

DEBUG = false

def hexlify(msg)
  msg.unpack("H*")[0]
end

def unhexlify(msg)
  [msg].pack("H*")
end

get '/' do
    erb :index, locals: { telegram: @last_telegram }
end

serial = SerialPort.new(
  ENV['DEVICE'] || '/dev/ttyUSB0',
  115200, # baud
  8, # data_bits
  1, # stop_bits
  SerialPort::NONE # parity = (previous_databits == 8 ? NONE : EVEN)
)

while true do
  raw = serial.read
  if !raw.empty?

    msg = hexlify(raw)
    msg_length = msg.size

    if DEBUG == true
      puts '--- start of data ---'
      puts msg
      puts '--- end of data ---'
    end

    # start byte has to be 0xDB
    start_byte_start = 0
    start_byte_end = start_byte_start + 1
    start_byte = msg[start_byte_start..start_byte_end]
    valid_start_byte_found = start_byte == 'db' ? true : false

    if valid_start_byte_found && msg_length == 992

      # system title length is 8 bytes
      system_title_length_start = 2
      system_title_length_end = system_title_length_start + 2 - 1
      system_title_length = msg[system_title_length_start..system_title_length_end].to_i(16)

      # system title
      system_title_start = 4
      system_title_end = system_title_start + 8 * 2 - 1
      system_title = msg[system_title_start..system_title_end]

      # length of subsequent bytes
      subsequent_bytes_start = system_title_end + 2 + 1
      subsequent_bytes_end = subsequent_bytes_start + 4 - 1
      subsequent_bytes = msg[subsequent_bytes_start..subsequent_bytes_end].to_i(16)

      # frame counter is cremented with every new frame
      frame_counter_length = 4 * 2 # 8 bytes
      frame_counter_start = subsequent_bytes_end + 3
      frame_counter_end = frame_counter_start + frame_counter_length - 1
      frame_counter = msg[frame_counter_start..frame_counter_end]

      # gcm tag
      gcm_tag_length = 12 * 2 # 12 bytes
      gcm_tag = msg[(msg_length - gcm_tag_length)..msg_length]

      # cipher text
      cipher_start = frame_counter_end + 1
      cipher_end = msg_length - gcm_tag_length - 1
      cipher = msg[cipher_start..cipher_end]

      if DEBUG == true
        puts 'frame length: ' + msg_length.to_s
        puts 'start byte: ' + start_byte
        puts 'system title length: ' + system_title_length.to_s + ' bytes'
        puts 'system title: ' + unhexlify(system_title) + ' (' + system_title + ')'
        puts 'subsequent bytes: ' + subsequent_bytes.to_s + ' bytes'
        puts 'frame counter: ' + frame_counter
        puts 'gcm_tag: ' + gcm_tag
        puts 'cipher: ' + cipher
      end

      # decrypting
      decipher = OpenSSL::Cipher.new('aes-128-gcm').decrypt
      decipher.key = unhexlify(ENV['KEY'])
      decipher.iv = unhexlify(system_title + frame_counter)
      decipher.auth_data = unhexlify('3000112233445566778899AABBCCDDEEFF')
      decipher.auth_tag = unhexlify(gcm_tag)
      decrypted = decipher.update(unhexlify(cipher)) #+ decipher.final

      puts '--- start of telegram ---'
      puts decrypted
      puts '--- end of telegram ---'

      @last_telegram = decrypted
      @last_received = DateTime.now

      valid_start_byte_found = false

    end
  end
end
